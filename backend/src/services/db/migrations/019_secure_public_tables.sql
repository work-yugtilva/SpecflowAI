-- 019_secure_public_tables.sql
--
-- Locks down user-owned tables that were still exposed through the public schema
-- and removes direct browser-role access to OAuth tokens.
--
-- Run order: must come after 018_fix_rls_types.sql.

-- ---------------------------------------------------------------------------
-- 1. session_state — user access scoped through owning session
-- ---------------------------------------------------------------------------

ALTER TABLE session_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own session_state" ON session_state;
CREATE POLICY "Users manage own session_state"
  ON session_state FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM sessions s
      WHERE s.id = session_state.session_id
        AND s.user_id = auth.uid()::TEXT
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM sessions s
      WHERE s.id = session_state.session_id
        AND s.user_id = auth.uid()::TEXT
    )
  );

DROP POLICY IF EXISTS "Service role full access on session_state" ON session_state;
CREATE POLICY "Service role full access on session_state"
  ON session_state FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 2. session_events — user access scoped through owning session
-- ---------------------------------------------------------------------------

ALTER TABLE session_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own session_events" ON session_events;
CREATE POLICY "Users manage own session_events"
  ON session_events FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM sessions s
      WHERE s.id = session_events.session_id
        AND s.user_id = auth.uid()::TEXT
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM sessions s
      WHERE s.id = session_events.session_id
        AND s.user_id = auth.uid()::TEXT
    )
  );

DROP POLICY IF EXISTS "Service role full access on session_events" ON session_events;
CREATE POLICY "Service role full access on session_events"
  ON session_events FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 3. context_entries — direct user ownership
-- ---------------------------------------------------------------------------

ALTER TABLE context_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own context_entries" ON context_entries;
CREATE POLICY "Users manage own context_entries"
  ON context_entries FOR ALL TO authenticated
  USING (user_id = auth.uid()::TEXT)
  WITH CHECK (user_id = auth.uid()::TEXT);

DROP POLICY IF EXISTS "Service role full access on context_entries" ON context_entries;
CREATE POLICY "Service role full access on context_entries"
  ON context_entries FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 4. product_profiles — direct user ownership
-- ---------------------------------------------------------------------------

ALTER TABLE product_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own product_profiles" ON product_profiles;
CREATE POLICY "Users manage own product_profiles"
  ON product_profiles FOR ALL TO authenticated
  USING (user_id = auth.uid()::TEXT)
  WITH CHECK (user_id = auth.uid()::TEXT);

DROP POLICY IF EXISTS "Service role full access on product_profiles" ON product_profiles;
CREATE POLICY "Service role full access on product_profiles"
  ON product_profiles FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 5. quality_scores — user access scoped through owning session
-- ---------------------------------------------------------------------------

ALTER TABLE quality_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own quality_scores" ON quality_scores;
CREATE POLICY "Users manage own quality_scores"
  ON quality_scores FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM sessions s
      WHERE s.id = quality_scores.session_id
        AND s.user_id = auth.uid()::TEXT
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM sessions s
      WHERE s.id = quality_scores.session_id
        AND s.user_id = auth.uid()::TEXT
    )
  );

DROP POLICY IF EXISTS "Service role full access on quality_scores" ON quality_scores;
CREATE POLICY "Service role full access on quality_scores"
  ON quality_scores FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 6. user_integrations — block browser-role access to raw OAuth tokens
-- ---------------------------------------------------------------------------

REVOKE ALL ON TABLE user_integrations FROM anon, authenticated;
GRANT ALL ON TABLE user_integrations TO service_role;
