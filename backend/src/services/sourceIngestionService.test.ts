import assert from 'node:assert/strict';
import test from 'node:test';
import zlib from 'node:zlib';

import {
  MAX_SOURCE_FILE_SIZE_BYTES,
  SourceIngestionError,
  installPdfNodePolyfills,
  parseSourceFile,
  validateUploadedFile,
} from './sourceIngestionService.js';

function makeFile(overrides: Partial<Express.Multer.File>): Express.Multer.File {
  const buffer = overrides.buffer ?? Buffer.from('hello world');
  return {
    fieldname: 'files',
    originalname: overrides.originalname ?? 'interview.txt',
    encoding: '7bit',
    mimetype: overrides.mimetype ?? 'text/plain',
    size: overrides.size ?? buffer.length,
    buffer,
    destination: '',
    filename: '',
    path: '',
    stream: undefined as never,
    ...overrides,
  };
}

function escapePdfText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function makeTextPdf(text: string): Buffer {
  const content = `BT /F1 12 Tf 72 720 Td (${escapePdfText(text)}) Tj ET`;
  return makePdfWithContentStream(content);
}

function makeAsciiHexTextPdf(text: string): Buffer {
  const content = `BT /F1 12 Tf 72 720 Td (${escapePdfText(text)}) Tj ET`;
  const encodedContent = `${Buffer.from(content, 'latin1').toString('hex').toUpperCase()}>`;
  return makePdfWithContentStream(encodedContent, '/Filter /ASCIIHexDecode');
}

function makePdfWithContentStream(content: string, descriptor = ''): Buffer {
  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
    `5 0 obj\n<< /Length ${Buffer.byteLength(content, 'latin1')} ${descriptor} >>\nstream\n${content}\nendstream\nendobj\n`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(pdf, 'latin1'));
    pdf += object;
  }
  const xrefOffset = Buffer.byteLength(pdf, 'latin1');
  pdf += 'xref\n0 6\n0000000000 65535 f \n';
  for (const offset of offsets.slice(1)) {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}

async function withDeletedPdfGlobals<T>(run: () => Promise<T> | T): Promise<T> {
  const globalRef = globalThis as typeof globalThis & {
    DOMMatrix?: unknown;
    ImageData?: unknown;
    Path2D?: unknown;
  };
  const previous = {
    DOMMatrix: globalRef.DOMMatrix,
    ImageData: globalRef.ImageData,
    Path2D: globalRef.Path2D,
  };
  delete globalRef.DOMMatrix;
  delete globalRef.ImageData;
  delete globalRef.Path2D;
  try {
    return await run();
  } finally {
    if (previous.DOMMatrix === undefined) delete globalRef.DOMMatrix;
    else globalRef.DOMMatrix = previous.DOMMatrix;
    if (previous.ImageData === undefined) delete globalRef.ImageData;
    else globalRef.ImageData = previous.ImageData;
    if (previous.Path2D === undefined) delete globalRef.Path2D;
    else globalRef.Path2D = previous.Path2D;
  }
}

test('txt parsing creates quote and pain point evidence from meaningful paragraphs', async () => {
  const file = makeFile({
    originalname: 'customer-interview.txt',
    mimetype: 'text/plain',
    buffer: Buffer.from(
      [
        'The onboarding flow is confusing and customers cannot finish setup without help from support.',
        '',
        'A second useful quote explains that manual CSV cleanup slows the weekly product review ritual.',
      ].join('\n')
    ),
  });

  const result = await parseSourceFile(file);

  assert.match(result.parsedText, /onboarding flow is confusing/);
  assert.match(result.summary, /customer-interview.txt/);
  assert.ok(result.evidence.some((item) => item.evidenceType === 'quote'));
  assert.ok(result.evidence.some((item) => item.evidenceType === 'pain_point'));
  assert.ok(result.evidence.length <= 50);
});

test('txt parsing creates fallback evidence from short parsed text', async () => {
  const file = makeFile({
    originalname: 'short-note.txt',
    mimetype: 'text/plain',
    buffer: Buffer.from('Checkout support gaps hurt teams.'),
  });

  const result = await parseSourceFile(file);

  assert.match(result.parsedText, /Checkout support gaps/);
  assert.equal(result.evidence.length, 1);
  assert.equal(result.evidence[0].evidenceType, 'observation');
  assert.match(result.evidence[0].content, /Checkout support gaps/);
});

test('text parsing removes null bytes before database storage', async () => {
  const file = makeFile({
    originalname: 'nul-byte-note.txt',
    mimetype: 'text/plain',
    buffer: Buffer.from(
      'Stripe Payments has a developer fi\u0000rst checkout flow, but failed local payment methods create manual review pain.'
    ),
  });

  const result = await parseSourceFile(file);

  assert.doesNotMatch(result.parsedText, /\u0000/);
  assert.doesNotMatch(result.summary, /\u0000/);
  assert.ok(result.evidence.length > 0);
  for (const item of result.evidence) {
    assert.doesNotMatch(item.title, /\u0000/);
    assert.doesNotMatch(item.content, /\u0000/);
  }
});

test('csv parsing creates metric evidence, observation evidence, and numeric metadata', async () => {
  const file = makeFile({
    originalname: 'usage.csv',
    mimetype: 'text/csv',
    buffer: Buffer.from(
      [
        'week,activation_rate,churn_count,notes',
        '1,0.25,12,baseline week',
        '2,0.40,8,activation improved',
        '3,0.50,5,churn reduced',
      ].join('\n')
    ),
  });

  const result = await parseSourceFile(file);

  assert.match(result.parsedText, /Rows: 3/);
  assert.deepEqual(result.metadata?.columns, ['week', 'activation_rate', 'churn_count', 'notes']);
  assert.ok((result.metadata?.numericColumns as string[]).includes('activation_rate'));
  assert.ok(result.evidence.some((item) => item.evidenceType === 'metric'));
  assert.ok(result.evidence.some((item) => item.evidenceType === 'observation'));
  assert.ok(result.evidence.length <= 100);
});

test('csv parsing creates fallback evidence when no metric columns are present', async () => {
  const file = makeFile({
    originalname: 'notes.csv',
    mimetype: 'text/csv',
    buffer: Buffer.from(
      [
        'customer,comment',
        'Acme,Checkout setup requires too much support',
        'Beta,Local payment method coverage blocks launch',
      ].join('\n')
    ),
  });

  const result = await parseSourceFile(file);

  assert.match(result.parsedText, /Rows: 2/);
  assert.equal(result.evidence.length, 1);
  assert.equal(result.evidence[0].evidenceType, 'observation');
  assert.match(result.evidence[0].content, /Checkout setup/);
});

test('pdf node polyfills define DOMMatrix before importing pdfjs', async () => {
  await withDeletedPdfGlobals(() => {
    const globalRef = globalThis as typeof globalThis & {
      DOMMatrix?: new (init?: number[]) => { a: number; d: number; e: number; f: number };
      ImageData?: unknown;
      Path2D?: unknown;
    };

    installPdfNodePolyfills();

    assert.equal(typeof globalRef.DOMMatrix, 'function');
    assert.equal(typeof globalRef.ImageData, 'function');
    assert.equal(typeof globalRef.Path2D, 'function');
    const matrix = new globalRef.DOMMatrix([1, 2, 3, 4, 5, 6]);
    assert.equal(matrix.a, 1);
    assert.equal(matrix.d, 4);
    assert.equal(matrix.e, 5);
    assert.equal(matrix.f, 6);
    const matrix16 = new globalRef.DOMMatrix([1, 2, 0, 0, 3, 4, 0, 0, 0, 0, 1, 0, 5, 6, 0, 1]);
    assert.equal(matrix16.c, 3);
    assert.equal(matrix16.f, 6);
  });
});

test('pdf parsing installs node polyfills and extracts selectable text', async () => {
  await withDeletedPdfGlobals(async () => {
    const pdfText =
      'Stripe product usage analysis shows developers cannot reconcile local payment method failures without manual review and customer churn rises.';
    const file = makeFile({
      originalname: 'stripe_product_usage_analysis.pdf',
      mimetype: 'application/pdf',
      buffer: makeTextPdf(pdfText),
    });

    const result = await parseSourceFile(file);

    assert.match(result.parsedText, /Stripe product usage analysis/);
    assert.ok(result.parsedText.length >= 50);
    assert.ok(result.evidence.length > 0);
    assert.equal(typeof (globalThis as { DOMMatrix?: unknown }).DOMMatrix, 'function');
  });
});

test('pdf parsing uses pdfjs for filtered streams that raw fallback cannot read', async () => {
  await withDeletedPdfGlobals(async () => {
    const pdfText =
      'Filtered Stripe usage evidence shows checkout teams cannot diagnose failed local payment methods without developer support.';
    const file = makeFile({
      originalname: 'filtered.pdf',
      mimetype: 'application/pdf',
      buffer: makeAsciiHexTextPdf(pdfText),
    });

    const result = await parseSourceFile(file);

    assert.match(result.parsedText, /Filtered Stripe usage evidence/);
    assert.ok(result.evidence.length > 0);
  });
});

test('pdf parsing falls back to raw text streams when pdf structure is invalid', async () => {
  const pdfText =
    'Stripe product usage analysis showed checkout conversion improved while churn reduction became a priority.';
  const content = `BT /F1 12 Tf 72 720 Td (${pdfText}) Tj ET`;
  const file = makeFile({
    originalname: 'stripe_product_usage_analysis.pdf',
    mimetype: 'application/pdf',
    buffer: Buffer.from(
      [
        '%PDF-1.7',
        '1 0 obj',
        `<< /Length ${content.length} >>`,
        'stream',
        content,
        'endstream',
        'endobj',
        '%%EOF',
      ].join('\n')
    ),
  });

  const result = await parseSourceFile(file);

  assert.match(result.parsedText, /Stripe product usage analysis/);
  assert.match(result.summary, /parsed \d+ words/);
  assert.ok(result.evidence.some((item) => item.evidenceType === 'quote'));
});

test('pdf parsing fallback extracts compressed FlateDecode text streams', async () => {
  const pdfText =
    'Stripe usage metrics revealed slow onboarding and manual reconciliation as recurring customer pain points.';
  const content = Buffer.from(`BT /F1 12 Tf 72 720 Td (${pdfText}) Tj ET`);
  const compressed = zlib.deflateSync(content);
  const file = makeFile({
    originalname: 'compressed.pdf',
    mimetype: 'application/pdf',
    buffer: Buffer.concat([
      Buffer.from(
        [
          '%PDF-1.7',
          '1 0 obj',
          `<< /Length ${compressed.length} /Filter /FlateDecode >>`,
          'stream',
          '',
        ].join('\n')
      ),
      compressed,
      Buffer.from('\nendstream\nendobj\n%%EOF'),
    ]),
  });

  const result = await parseSourceFile(file);

  assert.match(result.parsedText, /manual reconciliation/);
  assert.ok(result.evidence.some((item) => item.evidenceType === 'pain_point'));
});

test('unsupported file types are rejected before parsing', () => {
  const file = makeFile({
    originalname: 'archive.zip',
    mimetype: 'application/zip',
  });

  assert.throws(
    () => validateUploadedFile(file),
    (error) =>
      error instanceof SourceIngestionError &&
      error.code === 'UNSUPPORTED_FILE_TYPE'
  );
});

test('files over 10MB are rejected before parsing', () => {
  const file = makeFile({
    originalname: 'large.txt',
    mimetype: 'text/plain',
    size: MAX_SOURCE_FILE_SIZE_BYTES + 1,
  });

  assert.throws(
    () => validateUploadedFile(file),
    (error) =>
      error instanceof SourceIngestionError &&
      error.code === 'FILE_TOO_LARGE'
  );
});
