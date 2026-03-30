-- Research persistence for workspace-global and session-scoped discovery inputs.
-- Global rows use scope_key='global'
-- Session rows use scope_key='session:<session_id>'

CREATE TABLE IF NOT EXISTS research_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('global', 'session')),
  scope_key TEXT NOT NULL,
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  user_label TEXT NOT NULL DEFAULT '',
  pain_point TEXT NOT NULL DEFAULT '',
  context_text TEXT NOT NULL DEFAULT '',
  tags JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS research_entries_user_scope_idx
  ON research_entries(user_id, scope_key);

CREATE INDEX IF NOT EXISTS research_entries_session_id_idx
  ON research_entries(session_id);

CREATE INDEX IF NOT EXISTS research_entries_created_at_idx
  ON research_entries(created_at DESC);

COMMENT ON TABLE research_entries IS
  'Research inputs captured globally or per session for the SpecFlow discovery pipeline.';
