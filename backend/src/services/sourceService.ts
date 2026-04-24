import { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseClient } from '@/lib/supabase.js';
import type {
  ContextScope,
  PipelineSourceEvidence,
  SourceEvidence,
  SourceEvidenceType,
  SourceFile,
  SourceFileType,
  SourceStatus,
} from '@/types/index.js';
import type { ExtractedEvidence } from './sourceIngestionService.js';

const SOURCE_FILES_TABLE = 'source_files';
const SOURCE_EVIDENCE_TABLE = 'source_evidence';

type SourceScopeOptions = {
  scope?: ContextScope;
  sessionId?: string;
};

type SourceFileRow = {
  id: string;
  user_id: string;
  scope: ContextScope;
  scope_key: string;
  session_id: string | null;
  filename: string;
  mime_type: string | null;
  file_type: SourceFileType;
  file_size_bytes: number;
  status: SourceStatus;
  parsed_text: string | null;
  summary: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

type SourceEvidenceRow = {
  id: string;
  source_file_id: string;
  user_id: string;
  scope: ContextScope;
  scope_key: string;
  session_id: string | null;
  evidence_type: SourceEvidenceType;
  title: string;
  content: string;
  customer_label: string | null;
  theme: string | null;
  pain_point: string | null;
  product_area: string | null;
  sentiment: string | null;
  confidence: number | null;
  row_reference: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  source_files?: { filename?: string } | Array<{ filename?: string }> | null;
};

export class SourceService {
  constructor(private readonly client?: SupabaseClient) {}

  buildScopeKey(scope: ContextScope, sessionId?: string): string {
    if (scope === 'global') return 'global';
    if (!sessionId?.trim()) {
      throw new Error('sessionId is required when scope=session');
    }
    return `session:${sessionId.trim()}`;
  }

  async createSourceFile(
    userId: string,
    input: {
      scope: ContextScope;
      sessionId?: string;
      filename: string;
      mimeType?: string | null;
      fileType: SourceFileType;
      fileSizeBytes: number;
    },
    client?: SupabaseClient
  ): Promise<SourceFile> {
    const scopeKey = this.buildScopeKey(input.scope, input.sessionId);
    const { data, error } = await this.supabase(client)
      .from(SOURCE_FILES_TABLE)
      .insert({
        user_id: userId,
        scope: input.scope,
        scope_key: scopeKey,
        session_id: input.scope === 'session' ? input.sessionId ?? null : null,
        filename: input.filename,
        mime_type: input.mimeType ?? null,
        file_type: input.fileType,
        file_size_bytes: input.fileSizeBytes,
        status: 'processing',
      })
      .select('*')
      .single();

    if (error) throw new Error(`Failed to create source file: ${error.message}`);
    return this.toSourceFile(data as SourceFileRow);
  }

  async markProcessed(
    userId: string,
    sourceId: string,
    parsedText: string,
    summary: string,
    client?: SupabaseClient
  ): Promise<SourceFile> {
    const { data, error } = await this.supabase(client)
      .from(SOURCE_FILES_TABLE)
      .update({
        status: 'processed',
        parsed_text: parsedText,
        summary,
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('id', sourceId)
      .select('*')
      .single();

    if (error) throw new Error(`Failed to update source file: ${error.message}`);
    return this.toSourceFile(data as SourceFileRow);
  }

  async markFailed(
    userId: string,
    sourceId: string,
    message: string,
    client?: SupabaseClient
  ): Promise<SourceFile> {
    const { data, error } = await this.supabase(client)
      .from(SOURCE_FILES_TABLE)
      .update({
        status: 'failed',
        error_message: message,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('id', sourceId)
      .select('*')
      .single();

    if (error) throw new Error(`Failed to update source file: ${error.message}`);
    return this.toSourceFile(data as SourceFileRow);
  }

  async insertEvidence(
    userId: string,
    source: SourceFile,
    evidence: ExtractedEvidence[],
    client?: SupabaseClient
  ): Promise<SourceEvidence[]> {
    if (evidence.length === 0) return [];
    const rows = evidence.map((item) => ({
      source_file_id: source.id,
      user_id: userId,
      scope: source.scope,
      scope_key: source.scopeKey,
      session_id: source.sessionId ?? null,
      evidence_type: item.evidenceType,
      title: item.title,
      content: item.content,
      customer_label: item.customerLabel ?? null,
      theme: item.theme ?? null,
      pain_point: item.painPoint ?? null,
      product_area: item.productArea ?? null,
      sentiment: item.sentiment ?? null,
      confidence: item.confidence ?? null,
      row_reference: item.rowReference ?? null,
      metadata: item.metadata ?? {},
    }));

    const { data, error } = await this.supabase(client)
      .from(SOURCE_EVIDENCE_TABLE)
      .insert(rows)
      .select('*');

    if (error) throw new Error(`Failed to insert source evidence: ${error.message}`);
    return ((data ?? []) as SourceEvidenceRow[]).map((row) => this.toSourceEvidence(row));
  }

  async listSources(
    userId: string,
    options: SourceScopeOptions = {},
    client?: SupabaseClient
  ): Promise<SourceFile[]> {
    const scope = options.scope ?? 'global';
    const scopeKey = this.buildScopeKey(scope, options.sessionId);
    const { data, error } = await this.supabase(client)
      .from(SOURCE_FILES_TABLE)
      .select('*')
      .eq('user_id', userId)
      .eq('scope_key', scopeKey)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to fetch source files: ${error.message}`);

    const sources = ((data ?? []) as SourceFileRow[]).map((row) => this.toSourceFile(row));
    if (sources.length === 0) return sources;

    const sourceIds = sources.map((source) => source.id);
    const { data: evidenceRows } = await this.supabase(client)
      .from(SOURCE_EVIDENCE_TABLE)
      .select('source_file_id')
      .eq('user_id', userId)
      .in('source_file_id', sourceIds);

    const counts = new Map<string, number>();
    for (const row of (evidenceRows ?? []) as Array<{ source_file_id: string }>) {
      counts.set(row.source_file_id, (counts.get(row.source_file_id) ?? 0) + 1);
    }
    return sources.map((source) => ({
      ...source,
      evidenceCount: counts.get(source.id) ?? 0,
    }));
  }

  async getSourceWithEvidence(
    userId: string,
    sourceId: string,
    client?: SupabaseClient
  ): Promise<{ source: SourceFile; evidence: SourceEvidence[] } | null> {
    const { data, error } = await this.supabase(client)
      .from(SOURCE_FILES_TABLE)
      .select('*')
      .eq('user_id', userId)
      .eq('id', sourceId)
      .maybeSingle();

    if (error) throw new Error(`Failed to fetch source file: ${error.message}`);
    if (!data) return null;

    const { data: evidenceRows, error: evidenceError } = await this.supabase(client)
      .from(SOURCE_EVIDENCE_TABLE)
      .select('*')
      .eq('user_id', userId)
      .eq('source_file_id', sourceId)
      .order('created_at', { ascending: true });

    if (evidenceError) throw new Error(`Failed to fetch source evidence: ${evidenceError.message}`);

    return {
      source: this.toSourceFile(data as SourceFileRow),
      evidence: ((evidenceRows ?? []) as SourceEvidenceRow[]).map((row) =>
        this.toSourceEvidence(row)
      ),
    };
  }

  async deleteSource(userId: string, sourceId: string, client?: SupabaseClient): Promise<void> {
    const { error } = await this.supabase(client)
      .from(SOURCE_FILES_TABLE)
      .delete()
      .eq('user_id', userId)
      .eq('id', sourceId);

    if (error) throw new Error(`Failed to delete source file: ${error.message}`);
  }

  async listEvidenceForPipeline(
    userId: string,
    options: SourceScopeOptions = {},
    client?: SupabaseClient
  ): Promise<PipelineSourceEvidence[]> {
    const scope = options.scope ?? 'global';
    const scopeKey = this.buildScopeKey(scope, options.sessionId);
    const { data, error } = await this.supabase(client)
      .from(SOURCE_EVIDENCE_TABLE)
      .select('*, source_files(filename)')
      .eq('user_id', userId)
      .eq('scope_key', scopeKey)
      .order('created_at', { ascending: true })
      .limit(500);

    if (error) throw new Error(`Failed to fetch source evidence: ${error.message}`);

    return ((data ?? []) as SourceEvidenceRow[]).map((row) => this.toPipelineEvidence(row));
  }

  private supabase(client?: SupabaseClient): SupabaseClient {
    return client ?? this.client ?? getSupabaseClient();
  }

  private toSourceFile(row: SourceFileRow): SourceFile {
    return {
      id: row.id,
      userId: row.user_id,
      scope: row.scope,
      scopeKey: row.scope_key,
      sessionId: row.session_id,
      filename: row.filename,
      mimeType: row.mime_type,
      fileType: row.file_type,
      fileSizeBytes: row.file_size_bytes,
      status: row.status,
      parsedText: row.parsed_text,
      summary: row.summary,
      errorMessage: row.error_message,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private toSourceEvidence(row: SourceEvidenceRow): SourceEvidence {
    return {
      id: row.id,
      sourceFileId: row.source_file_id,
      userId: row.user_id,
      scope: row.scope,
      scopeKey: row.scope_key,
      sessionId: row.session_id,
      evidenceType: row.evidence_type,
      title: row.title,
      content: row.content,
      customerLabel: row.customer_label,
      theme: row.theme,
      painPoint: row.pain_point,
      productArea: row.product_area,
      sentiment: row.sentiment,
      confidence: row.confidence,
      rowReference: row.row_reference,
      metadata: row.metadata ?? {},
      createdAt: row.created_at,
    };
  }

  private toPipelineEvidence(row: SourceEvidenceRow): PipelineSourceEvidence {
    const source = Array.isArray(row.source_files) ? row.source_files[0] : row.source_files;
    return {
      id: row.id,
      source_id: row.source_file_id,
      source_title: source?.filename ?? 'Uploaded source',
      type: row.evidence_type,
      title: row.title,
      content: row.content,
      theme: row.theme,
      pain_point: row.pain_point,
      product_area: row.product_area,
      sentiment: row.sentiment,
      confidence: row.confidence,
      metadata: row.metadata ?? {},
    };
  }
}

export const sourceService = new SourceService();
