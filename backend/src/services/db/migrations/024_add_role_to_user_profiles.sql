-- Creates user_profiles if it doesn't exist yet (idempotent catch-up),
-- then adds the role column required for role-based onboarding.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_profiles'
  ) THEN
    CREATE TABLE user_profiles (
      user_id                 UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
      first_name              TEXT,
      last_name               TEXT,
      job_title               TEXT,
      company_name            TEXT,
      company_type            TEXT,
      work_experience         INTEGER,
      onboarding_completed_at TIMESTAMPTZ,
      created_at              TIMESTAMPTZ DEFAULT NOW(),
      updated_at              TIMESTAMPTZ DEFAULT NOW()
    );

    ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "Users manage own profile"
      ON user_profiles FOR ALL TO authenticated
      USING  (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- Add role column (safe to run multiple times).
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS role TEXT;
