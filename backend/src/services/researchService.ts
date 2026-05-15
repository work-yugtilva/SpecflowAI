import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/lib/supabase.js';
import {
  ContextScope,
  PaginatedResponse,
  ResearchEntry,
} from '@/types/index.js';

const RESEARCH_TABLE = 'research_entries';
const SESSIONS_TABLE = 'sessions';

export class ResearchSessionOwnershipError extends Error {
  statusCode = 404;
  code = 'SESSION_NOT_FOUND';

  constructor() {
    super('Session not found for user');
  }
}

interface ResearchRow {
  id: string;
  user_id: string;
  scope: ContextScope;
  scope_key: string;
  session_id: string | null;
  type: ResearchEntry['type'];
  title: string;
  content: string;
  user_label: string;
  pain_point: string;
  context_text: string;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  metric_name: string | null;
  metric_value: number | null;
  metric_baseline: number | null;
  metric_unit: string | null;
  time_period: string | null;
  data_source: string | null;
}

type ResearchListOptions = {
  scope?: ContextScope;
  sessionId?: string;
  page?: number;
  pageSize?: number;
};

const EMPTY_RESEARCH: Pick<
  ResearchEntry,
  'user' | 'pain' | 'context' | 'tags'
> = {
  user: '',
  pain: '',
  context: '',
  tags: [],
};

export class ResearchService {
  private buildScopeKey(scope: ContextScope, sessionId?: string): string {
    if (scope === 'global') return 'global';
    if (!sessionId?.trim()) {
      throw new Error('sessionId is required when scope=session');
    }
    return `session:${sessionId.trim()}`;
  }

  private toResearchEntry(row: ResearchRow): ResearchEntry {
    return {
      id: row.id,
      type: row.type,
      title: row.title,
      content: row.content,
      summary: row.content,
      user: row.user_label,
      pain: row.pain_point,
      context: row.context_text,
      tags: Array.isArray(row.tags) ? row.tags : [],
      scope: row.scope,
      sessionId: row.session_id,
      session_id: row.session_id,
      createdAt: row.created_at,
      created_at: row.created_at,
      updatedAt: row.updated_at,
      updated_at: row.updated_at,
      metricName:     row.metric_name     ?? undefined,
      metricValue:    row.metric_value    ?? undefined,
      metricBaseline: row.metric_baseline ?? undefined,
      metricUnit:     row.metric_unit     ?? undefined,
      timePeriod:     row.time_period     ?? undefined,
      dataSource:     row.data_source     ?? undefined,
    };
  }

  private async assertSessionOwned(
    userId: string,
    scope: ContextScope,
    sessionId: string | undefined,
    client?: SupabaseClient
  ): Promise<void> {
    if (scope === 'global') return;
    if (!sessionId?.trim()) {
      throw new Error('sessionId is required when scope=session');
    }
    const supabase = client || getSupabaseClient();
    const { data, error } = await supabase
      .from(SESSIONS_TABLE)
      .select('id')
      .eq('id', sessionId.trim())
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to validate session ownership: ${error.message}`);
    }
    if (!data) {
      throw new ResearchSessionOwnershipError();
    }
  }

  private async assertEntrySessionOwned(
    userId: string,
    entryId: string,
    client?: SupabaseClient
  ): Promise<void> {
    const supabase = client || getSupabaseClient();
    const { data, error } = await supabase
      .from(RESEARCH_TABLE)
      .select('scope, session_id')
      .eq('user_id', userId)
      .eq('id', entryId)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to validate research entry ownership: ${error.message}`);
    }
    if (!data) {
      throw new ResearchSessionOwnershipError();
    }

    const row = data as Pick<ResearchRow, 'scope' | 'session_id'>;
    if (row.scope === 'session') {
      await this.assertSessionOwned(userId, 'session', row.session_id ?? undefined, supabase);
    }
  }

  /**
   * Create a new research entry in the requested scope.
   */
  async createEntry(
    userId: string,
    entry: ResearchEntry,
    scope: ContextScope = 'global',
    sessionId?: string,
    client?: SupabaseClient
  ): Promise<ResearchEntry> {
    const supabase = client || getSupabaseClient();
    const scopeKey = this.buildScopeKey(scope, sessionId);
    await this.assertSessionOwned(userId, scope, sessionId, supabase);

    const payload = {
      user_id: userId,
      scope,
      scope_key: scopeKey,
      session_id: scope === 'session' ? sessionId ?? null : null,
      type: entry.type,
      title: entry.title.trim(),
      content: entry.content.trim(),
      user_label: entry.user?.trim() ?? '',
      pain_point: entry.pain?.trim() ?? '',
      context_text: entry.context?.trim() ?? '',
      tags: entry.tags ?? [],
      ...(entry.metricName     !== undefined && { metric_name:     entry.metricName }),
      ...(entry.metricValue    !== undefined && { metric_value:    entry.metricValue }),
      ...(entry.metricBaseline !== undefined && { metric_baseline: entry.metricBaseline }),
      ...(entry.metricUnit     !== undefined && { metric_unit:     entry.metricUnit }),
      ...(entry.timePeriod     !== undefined && { time_period:     entry.timePeriod }),
      ...(entry.dataSource     !== undefined && { data_source:     entry.dataSource }),
    };

    const { data, error } = await supabase
      .from(RESEARCH_TABLE)
      .insert(payload)
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to create research entry: ${error.message}`);
    }

    return this.toResearchEntry(data as ResearchRow);
  }

  /**
   * List research entries for a user and scope.
   */
  async getEntries(
    userId: string,
    options: ResearchListOptions = {},
    client?: SupabaseClient
  ): Promise<PaginatedResponse<ResearchEntry>> {
    const supabase = client || getSupabaseClient();
    const scope = options.scope ?? 'global';
    const page = Math.max(1, options.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 25));
    const scopeKey = this.buildScopeKey(scope, options.sessionId);
    await this.assertSessionOwned(userId, scope, options.sessionId, supabase);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error, count } = await supabase
      .from(RESEARCH_TABLE)
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .eq('scope_key', scopeKey)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      throw new Error(`Failed to fetch research entries: ${error.message}`);
    }

    const rows = (data ?? []) as ResearchRow[];
    const total = count ?? rows.length;

    return {
      success: true,
      data: rows.map((row) => this.toResearchEntry(row)),
      total,
      page,
      pageSize,
      totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
    };
  }

  /**
   * Get a single research entry owned by the user.
   */
  async getEntry(userId: string, entryId: string, client?: SupabaseClient): Promise<ResearchEntry | null> {
    const supabase = client || getSupabaseClient();

    const { data, error } = await supabase
      .from(RESEARCH_TABLE)
      .select('*')
      .eq('user_id', userId)
      .eq('id', entryId)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch research entry: ${error.message}`);
    }

    if (!data) return null;
    return this.toResearchEntry(data as ResearchRow);
  }

  /**
   * Update a single research entry owned by the user.
   */
  async updateEntry(
    userId: string,
    entryId: string,
    updates: Partial<ResearchEntry>,
    client?: SupabaseClient
  ): Promise<ResearchEntry> {
    const supabase = client || getSupabaseClient();
    await this.assertEntrySessionOwned(userId, entryId, supabase);

    const payload: Record<string, unknown> = {};
    if (updates.type) payload.type = updates.type;
    if (updates.title !== undefined) payload.title = updates.title.trim();
    if (updates.content !== undefined) payload.content = updates.content.trim();
    if (updates.user !== undefined) payload.user_label = updates.user.trim();
    if (updates.pain !== undefined) payload.pain_point = updates.pain.trim();
    if (updates.context !== undefined) payload.context_text = updates.context.trim();
    if (updates.tags !== undefined) payload.tags = updates.tags;
    if (updates.metricName     !== undefined) payload.metric_name     = updates.metricName;
    if (updates.metricValue    !== undefined) payload.metric_value    = updates.metricValue;
    if (updates.metricBaseline !== undefined) payload.metric_baseline = updates.metricBaseline;
    if (updates.metricUnit     !== undefined) payload.metric_unit     = updates.metricUnit;
    if (updates.timePeriod     !== undefined) payload.time_period     = updates.timePeriod;
    if (updates.dataSource     !== undefined) payload.data_source     = updates.dataSource;

    const { data, error } = await supabase
      .from(RESEARCH_TABLE)
      .update(payload)
      .eq('user_id', userId)
      .eq('id', entryId)
      .is('deleted_at', null)
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to update research entry: ${error.message}`);
    }

    return this.toResearchEntry(data as ResearchRow);
  }

  /**
   * Delete a single research entry owned by the user.
   */
  async deleteEntry(userId: string, entryId: string, client?: SupabaseClient): Promise<boolean> {
    const supabase = client || getSupabaseClient();
    await this.assertEntrySessionOwned(userId, entryId, supabase);

    const { error } = await supabase
      .from(RESEARCH_TABLE)
      .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('id', entryId);

    if (error) {
      throw new Error(`Failed to delete research entry: ${error.message}`);
    }

    return true;
  }

  /**
   * Search within the requested research scope.
   */
  async searchEntries(
    userId: string,
    query: string,
    scope: ContextScope = 'global',
    sessionId?: string,
    client?: SupabaseClient
  ): Promise<ResearchEntry[]> {
    const supabase = client || getSupabaseClient();
    const scopeKey = this.buildScopeKey(scope, sessionId);
    await this.assertSessionOwned(userId, scope, sessionId, supabase);
    const term = query.trim();

    if (!term) return [];

    const { data, error } = await supabase
      .from(RESEARCH_TABLE)
      .select('*')
      .eq('user_id', userId)
      .eq('scope_key', scopeKey)
      .is('deleted_at', null)
      .or(
        [
          `title.ilike.%${term}%`,
          `content.ilike.%${term}%`,
          `user_label.ilike.%${term}%`,
          `pain_point.ilike.%${term}%`,
          `context_text.ilike.%${term}%`,
        ].join(',')
      )
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      throw new Error(`Failed to search research entries: ${error.message}`);
    }

    return ((data ?? []) as ResearchRow[]).map((row) => this.toResearchEntry(row));
  }

  /**
   * Validate research entry input.
   */
  validateEntry(entry: Partial<ResearchEntry>): {
    valid: boolean;
    errors: string[];
  } {
    const normalized = { ...EMPTY_RESEARCH, ...entry };
    const errors: string[] = [];

    if (!normalized.type) {
      errors.push('Type is required');
    }
    if (!entry.title?.trim()) {
      errors.push('Title is required');
    }
    if (!entry.content?.trim()) {
      errors.push('Content is required');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

export const researchService = new ResearchService();
