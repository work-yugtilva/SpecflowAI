-- Add session_name-based identity for sessions.
-- This migration keeps project_id/user_id columns for backward compatibility.

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS session_name TEXT;

UPDATE sessions
SET session_name = COALESCE(
  NULLIF(TRIM(session_name), ''),
  NULLIF(TRIM(project_id), ''),
  'session-' || LEFT(id::text, 8)
)
WHERE session_name IS NULL OR TRIM(session_name) = '';

ALTER TABLE sessions
  ALTER COLUMN session_name SET NOT NULL;

CREATE INDEX IF NOT EXISTS sessions_session_name_idx
  ON sessions(session_name);

ALTER TABLE sessions
  ALTER COLUMN project_id DROP NOT NULL;

ALTER TABLE sessions
  ALTER COLUMN user_id DROP NOT NULL;
