-- Session System Tables
-- Run this in the Supabase SQL editor

-- sessions: identity + metadata for each execution session
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- session_state: full pipeline state at last completed step (one row per session, upserted)
CREATE TABLE IF NOT EXISTS session_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  state JSONB NOT NULL DEFAULT '{}',
  step TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS session_state_session_id_unique
  ON session_state(session_id);

-- session_events: append-only structured event log
CREATE TABLE IF NOT EXISTS session_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  payload JSONB DEFAULT '{}',
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Add session_id to existing memory_entries table for session-scoped memory
ALTER TABLE memory_entries ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES sessions(id) ON DELETE SET NULL;

-- Partial unique index: one memory entry per (session_id, memory_key) when session-scoped
CREATE UNIQUE INDEX IF NOT EXISTS memory_entries_session_key_unique
  ON memory_entries(session_id, memory_key)
  WHERE session_id IS NOT NULL;
