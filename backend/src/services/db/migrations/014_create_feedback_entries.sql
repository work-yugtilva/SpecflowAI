-- 014_create_feedback_entries.sql
-- Adds feedback_entries table for the PRD feedback loop feature.
-- Run order: must come after 013_add_embeddings.sql

CREATE TABLE IF NOT EXISTS feedback_entries (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id           UUID        NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id              TEXT        NOT NULL,
  prd_section          TEXT        NOT NULL,
  prd_item_title       TEXT        NOT NULL,
  feedback_type        TEXT        NOT NULL CHECK (feedback_type IN ('validated', 'invalidated', 'partial', 'deferred')),
  outcome_note         TEXT        NOT NULL DEFAULT '',
  linked_problem_ids   JSONB       NOT NULL DEFAULT '[]'::jsonb,
  linked_research_ids  JSONB       NOT NULL DEFAULT '[]'::jsonb,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS feedback_entries_session_id_idx ON feedback_entries (session_id);
CREATE INDEX IF NOT EXISTS feedback_entries_user_id_idx   ON feedback_entries (user_id);

ALTER TABLE feedback_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own feedback_entries"
  ON feedback_entries FOR ALL
  USING (user_id = auth.uid()::TEXT)
  WITH CHECK (user_id = auth.uid()::TEXT);

CREATE POLICY "Service role full access on feedback_entries"
  ON feedback_entries FOR ALL TO service_role
  USING (true) WITH CHECK (true);
