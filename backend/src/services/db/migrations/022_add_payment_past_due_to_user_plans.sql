ALTER TABLE user_plans
ADD COLUMN IF NOT EXISTS payment_past_due boolean NOT NULL DEFAULT false;
