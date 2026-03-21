import { getSupabaseClient } from '@/lib/supabase.js';
import { ContextData, ContextScope, ContextBundle } from '@/types/index.js';

const CONTEXT_TABLE = 'context_entries';

interface ContextRow {
  user_id: string;
  scope: ContextScope;
  scope_key: string;
  session_id: string | null;
  context_data: ContextData;
  created_at: string;
  updated_at: string;
}

const EMPTY_CONTEXT: ContextData = {
  companyName: '',
  companyType: '',
  productName: '',
  productDescription: '',
  targetUsers: '',
  goals: '',
  constraints: '',
};

export class ContextService {
  private buildScopeKey(scope: ContextScope, sessionId?: string): string {
    if (scope === 'global') return 'global';
    if (!sessionId?.trim()) {
      throw new Error('sessionId is required when scope=session');
    }
    return `session:${sessionId.trim()}`;
  }

  private toContextData(row: ContextRow): ContextData {
    return {
      ...EMPTY_CONTEXT,
      ...row.context_data,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Save or update context data for a user and scope.
   */
  async saveContext(
    userId: string,
    context: ContextData,
    scope: ContextScope = 'global',
    sessionId?: string
  ): Promise<ContextData> {
    const supabase = getSupabaseClient();
    const scopeKey = this.buildScopeKey(scope, sessionId);

    const { data, error } = await supabase
      .from(CONTEXT_TABLE)
      .upsert(
        {
          user_id: userId,
          scope,
          scope_key: scopeKey,
          session_id: scope === 'session' ? sessionId ?? null : null,
          context_data: context,
        },
        { onConflict: 'user_id,scope_key' }
      )
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to save context: ${error.message}`);
    }

    return this.toContextData(data as ContextRow);
  }

  /**
   * Get context data for a user and scope.
   */
  async getContext(
    userId: string,
    scope: ContextScope = 'global',
    sessionId?: string
  ): Promise<ContextData | null> {
    const supabase = getSupabaseClient();
    const scopeKey = this.buildScopeKey(scope, sessionId);

    const { data, error } = await supabase
      .from(CONTEXT_TABLE)
      .select('*')
      .eq('user_id', userId)
      .eq('scope_key', scopeKey)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch context: ${error.message}`);
    }

    if (!data) return null;
    return this.toContextData(data as ContextRow);
  }

  async getMergedContext(userId: string, sessionId: string): Promise<ContextBundle> {
    const globalContext = await this.getContext(userId, 'global');
    const sessionContext = await this.getContext(userId, 'session', sessionId);

    return {
      global: globalContext,
      session: sessionContext,
      merged: {
        ...EMPTY_CONTEXT,
        ...(globalContext ?? {}),
        ...(sessionContext ?? {}),
      },
    };
  }

  async importGlobalToSession(
    userId: string,
    sessionId: string
  ): Promise<ContextData | null> {
    const globalContext = await this.getContext(userId, 'global');
    if (!globalContext) return null;
    return this.saveContext(userId, globalContext, 'session', sessionId);
  }

  /**
   * Delete context data for a user and scope.
   */
  async deleteContext(
    userId: string,
    scope: ContextScope = 'global',
    sessionId?: string
  ): Promise<boolean> {
    const supabase = getSupabaseClient();
    const scopeKey = this.buildScopeKey(scope, sessionId);

    const { error } = await supabase
      .from(CONTEXT_TABLE)
      .delete()
      .eq('user_id', userId)
      .eq('scope_key', scopeKey);

    if (error) {
      throw new Error(`Failed to delete context: ${error.message}`);
    }

    return true;
  }

  /**
   * Validate context data
   */
  validateContext(context: Partial<ContextData>): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!context.companyName?.trim()) {
      errors.push('Company name is required');
    }
    if (!context.productName?.trim()) {
      errors.push('Product name is required');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

export const contextService = new ContextService();
