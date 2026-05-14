-- One OAuth integration row per user per provider.
-- user_id is TEXT to match existing tables (Supabase auth.uid()::TEXT).

CREATE TABLE IF NOT EXISTS user_integrations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      TEXT NOT NULL,
  provider     TEXT NOT NULL,
  access_token TEXT NOT NULL,
  workspace_info JSONB NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One row per user per provider
CREATE UNIQUE INDEX IF NOT EXISTS user_integrations_user_provider_uidx
  ON user_integrations(user_id, provider);

CREATE INDEX IF NOT EXISTS user_integrations_user_id_idx
  ON user_integrations(user_id);

-- RLS: each user can only manage their own rows
ALTER TABLE user_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own integrations"
  ON user_integrations
  FOR ALL
  USING  (user_id = auth.uid()::TEXT)
  WITH CHECK (user_id = auth.uid()::TEXT);

COMMENT ON TABLE user_integrations IS
  'OAuth tokens for third-party integrations. One row per user per provider.';
