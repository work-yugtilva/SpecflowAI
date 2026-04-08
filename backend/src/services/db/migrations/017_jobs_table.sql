-- Persistent job state. Backs the in-memory asyncio job registry so that
-- job status/result/error survive backend restarts. The SSE queue stays
-- in-process; only durable metadata is stored here.

CREATE TABLE IF NOT EXISTS jobs (
  id           TEXT PRIMARY KEY,                 -- 8-char job_id (matches in-memory key)
  session_id   UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id      TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','running','completed','failed')),
  job_type     TEXT NOT NULL DEFAULT 'pipeline', -- 'pipeline' | 'prd'
  result       JSONB,
  error        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS jobs_session_id_idx ON jobs(session_id);
CREATE INDEX IF NOT EXISTS jobs_user_id_idx    ON jobs(user_id);
CREATE INDEX IF NOT EXISTS jobs_status_idx     ON jobs(status);

ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on jobs"
  ON jobs FOR ALL TO service_role USING (true) WITH CHECK (true);
