-- 011_enable_rls.sql
--
-- Enables Row Level Security (RLS) for true B2B multi-tenancy.
-- Each user can only read and write their own rows.
--
-- Strategy:
--   - Tables with existing TEXT user_id: compare using auth.uid()::TEXT.
--   - Tables missing user_id (memory_entries, pipelines): add UUID column first.
--   - Every table also gets a service_role bypass so the FastAPI backend
--     (which may use the service role key for internal operations) is never blocked.
--
-- Run order: must come after all prior migrations (001–010).

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Add user_id columns to tables that are missing them
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE memory_entries
  ADD COLUMN IF NOT EXISTS user_id UUID;

ALTER TABLE pipelines
  ADD COLUMN IF NOT EXISTS user_id UUID;

CREATE INDEX IF NOT EXISTS memory_entries_user_id_idx ON memory_entries (user_id);
CREATE INDEX IF NOT EXISTS pipelines_user_id_idx        ON pipelines        (user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. sessions (user_id is TEXT — cast auth.uid() to match)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own sessions"
  ON sessions FOR ALL
  USING  (user_id = auth.uid()::TEXT)
  WITH CHECK (user_id = auth.uid()::TEXT);

-- Service role can read/write any row (backend pipeline operations)
CREATE POLICY "Service role full access on sessions"
  ON sessions FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. memory_entries (new UUID user_id — direct comparison)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE memory_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own memory entries"
  ON memory_entries FOR ALL
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Service role full access on memory_entries"
  ON memory_entries FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. pipelines (new UUID user_id — direct comparison)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE pipelines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own pipelines"
  ON pipelines FOR ALL
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Service role full access on pipelines"
  ON pipelines FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. research_entries (user_id is TEXT — cast auth.uid() to match)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE research_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own research entries"
  ON research_entries FOR ALL
  USING  (user_id = auth.uid()::TEXT)
  WITH CHECK (user_id = auth.uid()::TEXT);

CREATE POLICY "Service role full access on research_entries"
  ON research_entries FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. user_integrations (already has RLS from 010 — add service_role bypass)
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename  = 'user_integrations'
      AND policyname = 'Service role full access on user_integrations'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Service role full access on user_integrations"
        ON user_integrations FOR ALL TO service_role
        USING (true) WITH CHECK (true)
    $policy$;
  END IF;
END $$;

COMMENT ON COLUMN memory_entries.user_id IS
  'UUID of the owning Supabase auth user. Populated on insert by the backend. Required for RLS.';

COMMENT ON COLUMN pipelines.user_id IS
  'UUID of the owning Supabase auth user. Populated on insert by the backend. Required for RLS.';
