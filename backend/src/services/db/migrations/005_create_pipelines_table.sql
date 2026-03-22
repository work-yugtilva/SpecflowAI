-- Pipelines table: tracks individual pipeline runs with FK to sessions.
-- A pipeline run may be "orphaned" (session_id IS NULL) until the user saves it.

CREATE TABLE IF NOT EXISTS pipelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  input_data JSONB NOT NULL DEFAULT '{}',
  output_data JSONB NOT NULL DEFAULT '{}',
  current_step TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS pipelines_session_id_idx ON pipelines(session_id);
CREATE INDEX IF NOT EXISTS pipelines_status_idx ON pipelines(status);
CREATE INDEX IF NOT EXISTS pipelines_created_at_idx ON pipelines(created_at DESC);
