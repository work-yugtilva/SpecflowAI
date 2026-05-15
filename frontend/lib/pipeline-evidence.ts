export const NO_EVIDENCE_CODE = "NO_EVIDENCE";
export const NO_EVIDENCE_ERROR_MESSAGE =
  "NO_EVIDENCE: Cannot run pipeline — no sources or research entries " +
  "found for this session. Upload at least one document or add research " +
  "entries before running.";
export const NO_EVIDENCE_HTTP_MESSAGE =
  "Upload at least one source document before running the pipeline.";
export const NO_EVIDENCE_BANNER_MESSAGE =
  "No sources found. Upload a document or add research before running.";

export interface PipelineEvidenceInput {
  ingest?: unknown[] | null;
  research?: unknown[] | null;
}

export class NoEvidenceError extends Error {
  readonly code = NO_EVIDENCE_CODE;

  constructor(message: string = NO_EVIDENCE_ERROR_MESSAGE) {
    super(message);
    this.name = "NoEvidenceError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function isNoEvidenceError(error: unknown): boolean {
  if (error instanceof NoEvidenceError) return true;
  if (error && typeof error === "object") {
    const record = error as { code?: unknown; message?: unknown };
    if (record.code === NO_EVIDENCE_CODE) return true;
    if (
      typeof record.message === "string" &&
      record.message.includes(NO_EVIDENCE_CODE)
    ) {
      return true;
    }
  }
  return typeof error === "string" && error.includes(NO_EVIDENCE_CODE);
}

export function hasPipelineEvidence(input: PipelineEvidenceInput): boolean {
  const ingest = Array.isArray(input.ingest) ? input.ingest : [];
  const research = Array.isArray(input.research) ? input.research : [];
  return ingest.length + research.length > 0;
}
