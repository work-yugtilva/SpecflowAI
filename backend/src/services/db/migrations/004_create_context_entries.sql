-- Context persistence for workspace-global and session-scoped context.
-- Global rows use scope_key='global'
-- Session rows use scope_key='session:<session_id>'

CREATE TABLE IF NOT EXISTS context_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('global', 'session')),
  scope_key TEXT NOT NULL,
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  context_data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS context_entries_user_scope_key_uidx
  ON context_entries(user_id, scope_key);

CREATE INDEX IF NOT EXISTS context_entries_user_scope_idx
  ON context_entries(user_id, scope);

CREATE INDEX IF NOT EXISTS context_entries_session_id_idx
  ON context_entries(session_id);
