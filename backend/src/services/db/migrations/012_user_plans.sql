-- 012_user_plans.sql
--
-- Adds a user_plans table to track each user's subscription tier and usage.
-- Plans: free (2 full pipeline runs) | pro ($15 credit) | unlimited ($100 credit)
--
-- Run order: must come after 011_enable_rls.sql

CREATE TABLE IF NOT EXISTS user_plans (
  user_id                UUID    PRIMARY KEY,
  plan                   TEXT    NOT NULL DEFAULT 'free',
  pipeline_runs_used     INTEGER NOT NULL DEFAULT 0,
  api_credit_used_cents  INTEGER NOT NULL DEFAULT 0,
  stripe_customer_id     TEXT,
  stripe_subscription_id TEXT,
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups (primary key covers this, but explicit for clarity)
CREATE INDEX IF NOT EXISTS user_plans_plan_idx ON user_plans (plan);

-- Row Level Security
ALTER TABLE user_plans ENABLE ROW LEVEL SECURITY;

-- Users can read their own plan row
CREATE POLICY "Users read own plan"
  ON user_plans FOR SELECT
  USING (user_id = auth.uid());

-- Service role (FastAPI backend) can read and write all rows
CREATE POLICY "Service role full access on user_plans"
  ON user_plans FOR ALL TO service_role
  USING (true) WITH CHECK (true);

COMMENT ON TABLE user_plans IS
  'Tracks subscription plan and usage per user. Enforced by FastAPI PlanService.';

COMMENT ON COLUMN user_plans.plan IS
  'One of: free | pro | unlimited. Default free.';

COMMENT ON COLUMN user_plans.pipeline_runs_used IS
  'Number of full pipeline runs executed (all 5 steps). Used for free plan limit (max 2).';

COMMENT ON COLUMN user_plans.api_credit_used_cents IS
  'Estimated API credit consumed in cents. Used for pro ($1500 cap) and unlimited ($10000 cap) plans.';
