-- Allow NULL project_id for session-scoped memory entries
-- Session-scoped memory should not be constrained by project_id uniqueness

-- First, drop any unique indexes on project_id that would prevent NULL values
DROP INDEX IF EXISTS idx_memory_unique;
DROP INDEX IF EXISTS idx_memory_project_id_memory_key_unique;
DROP INDEX IF EXISTS memory_entries_project_id_memory_key_uidx;

-- Alter the project_id column to allow NULL
ALTER TABLE memory_entries ALTER COLUMN project_id DROP NOT NULL;

-- Ensure session-scoped unique index exists
CREATE UNIQUE INDEX IF NOT EXISTS memory_entries_session_memory_key_uidx
  ON memory_entries(session_id, memory_key);
