-- Fix: Session API / pipeline upsert fails with:
--   42P10: there is no unique or exclusion constraint matching the ON CONFLICT specification
-- Cause: partial unique index memory_entries_session_key_unique is not a valid ON CONFLICT target
--        for ON CONFLICT (session_id, memory_key) from Supabase upsert.
-- Run in Supabase SQL editor if you already applied an older 001 that created the partial index.

DROP INDEX IF EXISTS memory_entries_session_key_unique;

CREATE UNIQUE INDEX IF NOT EXISTS memory_entries_session_memory_key_uidx
  ON memory_entries(session_id, memory_key);
