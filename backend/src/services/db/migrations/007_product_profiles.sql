-- Product profiles: cross-session product context persistence.
-- One row per (user_id, product_name). Allows context to persist
-- across sessions so PMs don't re-enter product info every run.

CREATE TABLE IF NOT EXISTS product_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  product_description TEXT NOT NULL DEFAULT '',
  target_user TEXT NOT NULL DEFAULT '',
  core_workflow TEXT NOT NULL DEFAULT '',
  constraints TEXT NOT NULL DEFAULT '',
  competitors TEXT NOT NULL DEFAULT '',
  goals TEXT NOT NULL DEFAULT '',
  raw_summary TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS product_profiles_user_product_uidx
  ON product_profiles(user_id, product_name);

CREATE INDEX IF NOT EXISTS product_profiles_user_id_idx
  ON product_profiles(user_id);

COMMENT ON TABLE product_profiles IS
  'Cross-session product context. Populated by ProductContextAgent, reused across sessions.';
