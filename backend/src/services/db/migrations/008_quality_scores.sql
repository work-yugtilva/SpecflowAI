-- Quality scores: per-step rubric results for observability and trust display.

CREATE TABLE IF NOT EXISTS quality_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  step_name TEXT NOT NULL,
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  passed BOOLEAN NOT NULL,
  critical_issues JSONB NOT NULL DEFAULT '[]',
  item_scores JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS quality_scores_session_id_idx
  ON quality_scores(session_id);

CREATE INDEX IF NOT EXISTS quality_scores_step_name_idx
  ON quality_scores(step_name);

COMMENT ON TABLE quality_scores IS
  'Non-blocking quality gate results per pipeline step. Used for dashboard display and debugging.';
