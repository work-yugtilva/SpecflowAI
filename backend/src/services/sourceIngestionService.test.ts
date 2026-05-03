import assert from 'node:assert/strict';
import test from 'node:test';
import zlib from 'node:zlib';

import {
  MAX_SOURCE_FILE_SIZE_BYTES,
  SourceIngestionError,
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
