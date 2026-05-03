import path from 'node:path';
import zlib from 'node:zlib';

import { parse as parseCsv } from 'csv-parse/sync';
import mammoth from 'mammoth';

import type { SourceEvidenceType, SourceFileType } from '@/types/index.js';

export const MAX_SOURCE_FILE_SIZE_BYTES = 10 * 1024 * 1024;

const ALLOWED_FILE_TYPES = new Set<SourceFileType>(['txt', 'pdf', 'docx', 'csv']);
const GENERIC_MIME_TYPES = new Set(['', 'application/octet-stream']);
const MIME_TYPES: Record<SourceFileType, Set<string>> = {
  txt: new Set(['text/plain']),
  csv: new Set(['text/csv', 'application/csv', 'text/plain', 'application/vnd.ms-excel']),
  pdf: new Set(['application/pdf']),
  docx: new Set([
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/zip',
  ]),
};
const PAIN_POINT_PATTERN =
  /\b(problem|pain|frustrated|blocked|confusing|churn|slow|manual|hard|can't|cannot|issue)\b/i;
const OBSERVATION_COLUMN_PATTERN =
  /(funnel|conversion|activation|retention|churn)/i;

export type ExtractedEvidence = {
  evidenceType: SourceEvidenceType;
  title: string;
  content: string;
  customerLabel?: string | null;
  theme?: string | null;
  painPoint?: string | null;
  productArea?: string | null;
  sentiment?: string | null;
  confidence?: number | null;
  rowReference?: string | null;
  metadata?: Record<string, unknown>;
};

export type SourceParseResult = {
  parsedText: string;
  summary: string;
  evidence: ExtractedEvidence[];
  metadata?: Record<string, unknown>;
};

export class SourceIngestionError extends Error {
  override readonly name = 'SourceIngestionError';

  constructor(
    public readonly code: 'FILE_TOO_LARGE' | 'UNSUPPORTED_FILE_TYPE' | 'PARSE_FAILED',
    message: string,
    public readonly statusCode = 400
  ) {
    super(message);
  }
}

export function sanitizeFilename(filename: string): string {
  const base = path.basename(filename || 'source');
  return base.replace(/[^\w.\- ()]/g, '_').slice(0, 180) || 'source';
}

export function getFileType(filename: string): SourceFileType | null {
  const ext = path.extname(filename).replace('.', '').toLowerCase();
  return ALLOWED_FILE_TYPES.has(ext as SourceFileType) ? (ext as SourceFileType) : null;
}

export function validateUploadedFile(file: Express.Multer.File): SourceFileType {
  if (file.size > MAX_SOURCE_FILE_SIZE_BYTES) {
    throw new SourceIngestionError('FILE_TOO_LARGE', 'File is too large', 413);
  }

  const fileType = getFileType(file.originalname);
  if (!fileType) {
    throw new SourceIngestionError('UNSUPPORTED_FILE_TYPE', 'Unsupported file type');
  }

  const mime = (file.mimetype ?? '').toLowerCase();
  if (!GENERIC_MIME_TYPES.has(mime) && !MIME_TYPES[fileType].has(mime)) {
    throw new SourceIngestionError('UNSUPPORTED_FILE_TYPE', 'Unsupported file type');
  }

  return fileType;
}

export async function parseSourceFile(file: Express.Multer.File): Promise<SourceParseResult> {
  const fileType = validateUploadedFile(file);
  const filename = sanitizeFilename(file.originalname);

  try {
    if (fileType === 'csv') {
      return parseCsvFile(file.buffer, filename);
    }

    const parsedText =
      fileType === 'txt'
        ? file.buffer.toString('utf8')
        : fileType === 'pdf'
        ? await extractPdfText(file.buffer)
        : (await mammoth.extractRawText({ buffer: file.buffer })).value;

    const normalizedText = normalizeWhitespace(parsedText);
    const evidence = extractTextEvidence(normalizedText);
    return {
      parsedText: normalizedText,
      summary: buildTextSummary(filename, normalizedText, evidence.length),
      evidence,
    };
  } catch (error) {
    throw new SourceIngestionError(
      'PARSE_FAILED',
      error instanceof Error ? error.message : 'Unable to parse file'
    );
  }
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  let parser: { getText: () => Promise<{ text: string }>; destroy: () => Promise<void> } | null = null;
  try {
    await installPdfCanvasGlobals();
    const { PDFParse } = await import('pdf-parse');
    parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    return result.text || extractPdfTextFromRawStreams(buffer);
  } catch (error) {
    const fallbackText = extractPdfTextFromRawStreams(buffer);
    if (fallbackText) return fallbackText;
    throw error;
  } finally {
    await parser?.destroy();
  }
}

async function installPdfCanvasGlobals(): Promise<void> {
  const canvas = await import('@napi-rs/canvas');
  const runtimeGlobal = globalThis as typeof globalThis & {
    DOMMatrix?: unknown;
    ImageData?: unknown;
    Path2D?: unknown;
  };
  runtimeGlobal.DOMMatrix ??= canvas.DOMMatrix;
  runtimeGlobal.ImageData ??= canvas.ImageData;
  runtimeGlobal.Path2D ??= canvas.Path2D;
}

function extractPdfTextFromRawStreams(buffer: Buffer): string {
  const source = buffer.toString('latin1');
  const chunks: string[] = [];
  const streamPattern = /<<(.*?)>>\s*stream\r?\n?([\s\S]*?)\r?\n?endstream/g;
  let match: RegExpExecArray | null;

  while ((match = streamPattern.exec(source))) {
    const [, descriptor, rawStream] = match;
    const streamBuffer = Buffer.from(rawStream, 'latin1');
    const candidates = [streamBuffer, stripOuterNewlines(streamBuffer)];
    for (const candidate of candidates) {
      const content = descriptor.includes('/FlateDecode')
        ? inflatePdfStream(candidate)
        : candidate.toString('latin1');
      if (content) chunks.push(extractTextOperators(content));
    }
  }

  if (chunks.length === 0) {
    chunks.push(extractTextOperators(source));
  }

  return normalizeWhitespace(chunks.filter(Boolean).join('\n'));
}

function stripOuterNewlines(buffer: Buffer): Buffer {
  let start = 0;
  let end = buffer.length;
  while (start < end && (buffer[start] === 0x0a || buffer[start] === 0x0d)) start += 1;
  while (end > start && (buffer[end - 1] === 0x0a || buffer[end - 1] === 0x0d)) end -= 1;
  return buffer.subarray(start, end);
}

function inflatePdfStream(buffer: Buffer): string {
  try {
    return zlib.inflateSync(buffer).toString('latin1');
  } catch {
    return '';
  }
}

function extractTextOperators(content: string): string {
  const parts: string[] = [];

  for (const arrayMatch of content.matchAll(/\[((?:\\.|[^\]])*)\]\s*TJ/g)) {
    parts.push(...extractPdfLiteralStrings(arrayMatch[1]).map(decodePdfLiteralString));
    parts.push(...extractPdfHexStrings(arrayMatch[1]).map(decodePdfHexString));
  }

  for (const stringMatch of content.matchAll(/\(((?:\\.|[^\\()])*)\)\s*(?:Tj|'|")/g)) {
    parts.push(decodePdfLiteralString(stringMatch[1]));
  }

  for (const hexMatch of content.matchAll(/<([0-9A-Fa-f\s]+)>\s*Tj/g)) {
    parts.push(decodePdfHexString(hexMatch[1]));
  }

  return parts.filter(Boolean).join(' ');
}

function extractPdfLiteralStrings(content: string): string[] {
  return [...content.matchAll(/\(((?:\\.|[^\\()])*)\)/g)].map((match) => match[1]);
}

function extractPdfHexStrings(content: string): string[] {
  return [...content.matchAll(/<([0-9A-Fa-f\s]+)>/g)].map((match) => match[1]);
}

function decodePdfLiteralString(value: string): string {
  return value.replace(/\\([0-7]{1,3}|[nrtbf()\\])/g, (_match, escape: string) => {
    if (/^[0-7]+$/.test(escape)) return String.fromCharCode(parseInt(escape, 8));
    const escapes: Record<string, string> = {
      n: '\n',
      r: '\r',
      t: '\t',
      b: '\b',
      f: '\f',
      '(': '(',
      ')': ')',
      '\\': '\\',
    };
    return escapes[escape] ?? escape;
  });
}

function decodePdfHexString(value: string): string {
  const cleaned = value.replace(/\s+/g, '');
  if (!cleaned || cleaned.length % 2 !== 0) return '';
  const bytes = Buffer.from(cleaned, 'hex');
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return decodeUtf16Be(bytes.subarray(2));
  }
  if (bytes.length > 2 && bytes.every((byte, index) => index % 2 === 0 || byte < 128)) {
    const likelyUtf16 = bytes.filter((_byte, index) => index % 2 === 0).every((byte) => byte === 0);
    if (likelyUtf16) return decodeUtf16Be(bytes);
  }
  return bytes.toString('latin1');
}

function decodeUtf16Be(bytes: Buffer): string {
  const chars: string[] = [];
  for (let i = 0; i + 1 < bytes.length; i += 2) {
    chars.push(String.fromCharCode((bytes[i] << 8) | bytes[i + 1]));
  }
  return chars.join('');
}

function normalizeWhitespace(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function buildTextSummary(filename: string, text: string, evidenceCount: number): string {
  const words = text.split(/\s+/).filter(Boolean).length;
  return `${filename}: parsed ${words} words and extracted ${evidenceCount} evidence item${evidenceCount === 1 ? '' : 's'}.`;
}

function extractTextEvidence(text: string): ExtractedEvidence[] {
  const paragraphs = text
    .split(/\n\s*\n|(?<=\.)\s+(?=[A-Z])/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 40);

  const evidence: ExtractedEvidence[] = [];
  for (const paragraph of paragraphs) {
    if (evidence.length >= 50) break;
    evidence.push({
      evidenceType: 'quote',
      title: makeTitle('Quote', paragraph),
      content: paragraph,
      confidence: 1,
      metadata: { extraction: 'paragraph' },
    });

    if (evidence.length >= 50) break;
    if (PAIN_POINT_PATTERN.test(paragraph)) {
      evidence.push({
        evidenceType: 'pain_point',
        title: makeTitle('Pain point', paragraph),
        content: paragraph,
        painPoint: paragraph,
        confidence: 0.75,
        metadata: { extraction: 'keyword_match' },
      });
    }
  }

  return evidence.slice(0, 50);
}

function parseCsvFile(buffer: Buffer, filename: string): SourceParseResult {
  const records = parseCsv(buffer, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Array<Record<string, string>>;

  const columns = records.length > 0 ? Object.keys(records[0]) : [];
  const numericColumns = columns.filter((column) =>
    records.some((row) => parseNumeric(row[column]) !== null)
  );
  const stats = Object.fromEntries(
    numericColumns.map((column) => [column, computeStats(records, column)])
  );
  const metadata = {
    rowCount: records.length,
    columns,
    numericColumns,
    stats,
  };
  const parsedText = buildCsvText(records, columns, metadata);
  const evidence: ExtractedEvidence[] = [];

  for (const column of numericColumns) {
    if (evidence.length >= 100) break;
    const stat = stats[column];
    evidence.push({
      evidenceType: 'metric',
      title: `Metric ${column}`,
      content: `${column} has ${stat.count} numeric value${stat.count === 1 ? '' : 's'} with min ${formatNumber(stat.min)}, max ${formatNumber(stat.max)}, and average ${formatNumber(stat.average)}.`,
      confidence: 1,
      metadata: {
        metricName: column,
        metric_name: column,
        metricValue: stat.average,
        metric_value: stat.average,
        count: stat.count,
        min: stat.min,
        max: stat.max,
        average: stat.average,
        dataSource: filename,
        data_source: filename,
      },
    });
  }

  for (const column of columns.filter((name) => OBSERVATION_COLUMN_PATTERN.test(name))) {
    if (evidence.length >= 100) break;
    const stat = stats[column];
    evidence.push({
      evidenceType: 'observation',
      title: `Observation ${column}`,
      content: stat
        ? `${column} appears to be a funnel or lifecycle metric. Average value is ${formatNumber(stat.average)} across ${stat.count} numeric rows.`
        : `${column} appears to describe funnel or lifecycle behavior across ${records.length} rows.`,
      theme: inferTheme(column),
      confidence: 0.8,
      metadata: {
        column,
        rowCount: records.length,
        ...(stat ? { metricName: column, metric_name: column, metricValue: stat.average, metric_value: stat.average } : {}),
      },
    });
  }

  return {
    parsedText,
    summary: `${filename}: parsed ${records.length} CSV row${records.length === 1 ? '' : 's'} across ${columns.length} column${columns.length === 1 ? '' : 's'}.`,
    evidence: evidence.slice(0, 100),
    metadata,
  };
}

function buildCsvText(
  records: Array<Record<string, string>>,
  columns: string[],
  metadata: Record<string, unknown>
): string {
  const previewRows = records
    .slice(0, 20)
    .map((row, index) => {
      const values = columns.map((column) => `${column}=${row[column] ?? ''}`).join(', ');
      return `Row ${index + 1}: ${values}`;
    })
    .join('\n');

  return [
    `Rows: ${records.length}`,
    `Columns: ${columns.join(', ')}`,
    `Numeric columns: ${(metadata.numericColumns as string[]).join(', ') || 'none'}`,
    previewRows,
  ]
    .filter(Boolean)
    .join('\n');
}

function computeStats(records: Array<Record<string, string>>, column: string) {
  const values = records
    .map((row) => parseNumeric(row[column]))
    .filter((value): value is number => value !== null);
  const total = values.reduce((sum, value) => sum + value, 0);
  return {
    count: values.length,
    min: Math.min(...values),
    max: Math.max(...values),
    average: values.length > 0 ? total / values.length : 0,
  };
}

function parseNumeric(value: string | undefined): number | null {
  if (value == null || value.trim() === '') return null;
  const normalized = value.trim().replace(/[%,$]/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function makeTitle(prefix: string, content: string): string {
  const text = content.replace(/\s+/g, ' ').trim();
  return `${prefix}: ${text.slice(0, 72)}${text.length > 72 ? '...' : ''}`;
}

function inferTheme(column: string): string {
  const lower = column.toLowerCase();
  if (lower.includes('activation')) return 'activation';
  if (lower.includes('retention')) return 'retention';
  if (lower.includes('churn')) return 'churn';
  if (lower.includes('conversion') || lower.includes('funnel')) return 'conversion';
  return 'usage';
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}
