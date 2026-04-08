-- 018_fix_rls_types.sql
--
-- Standardizes all user_id columns and RLS policy expressions to TEXT / auth.uid()::TEXT.
--
-- Background:
--   Migration 011 introduced a split: tables that already had TEXT user_id columns
--   kept that type and used auth.uid()::TEXT in their policies. Tables that needed a
--   new user_id column (memory_entries, pipelines) were given UUID, and user_plans
--   was created with UUID primary key — both used bare auth.uid() in their policies.
--
--   The FastAPI backend always passes str(user_id) from the JWT, so TEXT is the de
--   facto standard. Mixing UUID and TEXT creates a maintenance hazard: copy-pasting a
--   policy from a TEXT table to a UUID table (or vice versa) produces silently wrong
--   access control with no error at CREATE POLICY time.
--
-- Policy type audit (state BEFORE this migration):
--   Table                | user_id type | Policy expression         | Action
--   ---------------------|--------------|---------------------------|------------------
--   sessions             | TEXT         | auth.uid()::TEXT          | already correct
--   memory_entries       | UUID         | auth.uid()                | converted here
--   pipelines            | UUID         | auth.uid()                | converted here
--   research_entries     | TEXT         | auth.uid()::TEXT          | already correct
--   user_integrations    | TEXT         | auth.uid()::TEXT          | already correct
--   user_plans           | UUID (PK)    | auth.uid()                | converted here
--   feedback_entries     | TEXT         | auth.uid()::TEXT          | already correct
--   jobs                 | TEXT         | service_role only         | no user policy (intentional)
--   session_state        | –            | no RLS                    | out of scope
--   session_events       | –            | no RLS                    | out of scope
--   context_entries      | –            | no RLS                    | out of scope
--   product_profiles     | –            | no RLS                    | out of scope
--   quality_scores       | –            | no RLS                    | out of scope
--
-- Standard going forward:
--   user_id column type  →  TEXT
--   RLS policy expression → user_id = auth.uid()::TEXT
--
-- Run order: must come after 017_jobs_table.sql.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. memory_entries — UUID → TEXT
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY "Users manage their own memory entries" ON memory_entries;

ALTER TABLE memory_entries
  ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;

CREATE POLICY "Users manage their own memory entries"
  ON memory_entries FOR ALL
  USING  (user_id = auth.uid()::TEXT)
  WITH CHECK (user_id = auth.uid()::TEXT);

COMMENT ON COLUMN memory_entries.user_id IS
  'TEXT user_id of the owning Supabase auth user. Standard: auth.uid()::TEXT (see migration 018).';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. pipelines — UUID → TEXT
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY "Users manage their own pipelines" ON pipelines;

ALTER TABLE pipelines
  ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;

CREATE POLICY "Users manage their own pipelines"
  ON pipelines FOR ALL
  USING  (user_id = auth.uid()::TEXT)
  WITH CHECK (user_id = auth.uid()::TEXT);

COMMENT ON COLUMN pipelines.user_id IS
  'TEXT user_id of the owning Supabase auth user. Standard: auth.uid()::TEXT (see migration 018).';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. user_plans — UUID (PK) → TEXT
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY "Users read own plan" ON user_plans;

ALTER TABLE user_plans
  ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;

CREATE POLICY "Users read own plan"
  ON user_plans FOR SELECT
  USING (user_id = auth.uid()::TEXT);

COMMENT ON COLUMN user_plans.user_id IS
  'TEXT user_id primary key. Standard: auth.uid()::TEXT (see migration 018).';
