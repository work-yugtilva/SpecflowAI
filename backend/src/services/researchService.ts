import { getSupabaseClient } from '@/lib/supabase.js';
import {
  ContextScope,
  PaginatedResponse,
  ResearchEntry,
} from '@/types/index.js';

const RESEARCH_TABLE = 'research_entries';

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
      user: row.user_label,
      pain: row.pain_point,
      context: row.context_text,
      tags: Array.isArray(row.tags) ? row.tags : [],
      scope: row.scope,
      sessionId: row.session_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Create a new research entry in the requested scope.
   */
  async createEntry(
    userId: string,
    entry: ResearchEntry,
    scope: ContextScope = 'global',
    sessionId?: string
  ): Promise<ResearchEntry> {
    const supabase = getSupabaseClient();
    const scopeKey = this.buildScopeKey(scope, sessionId);

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
    options: ResearchListOptions = {}
  ): Promise<PaginatedResponse<ResearchEntry>> {
    const supabase = getSupabaseClient();
    const scope = options.scope ?? 'global';
    const page = Math.max(1, options.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 25));
    const scopeKey = this.buildScopeKey(scope, options.sessionId);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error, count } = await supabase
      .from(RESEARCH_TABLE)
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .eq('scope_key', scopeKey)
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
  async getEntry(userId: string, entryId: string): Promise<ResearchEntry | null> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from(RESEARCH_TABLE)
      .select('*')
      .eq('user_id', userId)
      .eq('id', entryId)
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
    updates: Partial<ResearchEntry>
  ): Promise<ResearchEntry> {
    const supabase = getSupabaseClient();

    const payload: Record<string, unknown> = {};
    if (updates.type) payload.type = updates.type;
    if (updates.title !== undefined) payload.title = updates.title.trim();
    if (updates.content !== undefined) payload.content = updates.content.trim();
    if (updates.user !== undefined) payload.user_label = updates.user.trim();
    if (updates.pain !== undefined) payload.pain_point = updates.pain.trim();
    if (updates.context !== undefined) payload.context_text = updates.context.trim();
    if (updates.tags !== undefined) payload.tags = updates.tags;

    const { data, error } = await supabase
      .from(RESEARCH_TABLE)
      .update(payload)
      .eq('user_id', userId)
      .eq('id', entryId)
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
  async deleteEntry(userId: string, entryId: string): Promise<boolean> {
    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from(RESEARCH_TABLE)
      .delete()
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
    sessionId?: string
  ): Promise<ResearchEntry[]> {
    const supabase = getSupabaseClient();
    const scopeKey = this.buildScopeKey(scope, sessionId);
    const term = query.trim();

    if (!term) return [];

    const { data, error } = await supabase
      .from(RESEARCH_TABLE)
      .select('*')
      .eq('user_id', userId)
      .eq('scope_key', scopeKey)
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
