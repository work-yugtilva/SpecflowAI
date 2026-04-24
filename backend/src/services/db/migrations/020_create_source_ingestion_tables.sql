-- 020_create_source_ingestion_tables.sql
-- Stores uploaded source files and deterministic evidence extracted from them.
-- Run order: must come after 019_secure_public_tables.sql.

CREATE TABLE IF NOT EXISTS source_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('global', 'session')),
  scope_key TEXT NOT NULL,
  session_id UUID NULL REFERENCES sessions(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  mime_type TEXT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('txt', 'pdf', 'docx', 'csv')),
  file_size_bytes INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('uploaded', 'processing', 'processed', 'failed')) DEFAULT 'uploaded',
  parsed_text TEXT NULL,
  summary TEXT NULL,
  error_message TEXT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS source_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_file_id UUID NOT NULL REFERENCES source_files(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('global', 'session')),
  scope_key TEXT NOT NULL,
  session_id UUID NULL REFERENCES sessions(id) ON DELETE CASCADE,
  evidence_type TEXT NOT NULL CHECK (evidence_type IN ('quote', 'pain_point', 'theme', 'metric', 'observation')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  customer_label TEXT NULL,
  theme TEXT NULL,
  pain_point TEXT NULL,
  product_area TEXT NULL,
  sentiment TEXT NULL,
  confidence NUMERIC NULL,
  row_reference TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS source_files_user_scope_created_idx
  ON source_files(user_id, scope_key, created_at DESC);

CREATE INDEX IF NOT EXISTS source_files_user_id_idx
  ON source_files(user_id);

CREATE INDEX IF NOT EXISTS source_evidence_user_scope_source_idx
  ON source_evidence(user_id, scope_key, source_file_id);

CREATE INDEX IF NOT EXISTS source_evidence_user_type_idx
  ON source_evidence(user_id, evidence_type);

CREATE INDEX IF NOT EXISTS source_evidence_user_id_idx
  ON source_evidence(user_id);

ALTER TABLE source_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_evidence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own source_files" ON source_files;
CREATE POLICY "Users manage own source_files"
  ON source_files FOR ALL TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Service role full access on source_files" ON source_files;
CREATE POLICY "Service role full access on source_files"
  ON source_files FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users manage own source_evidence" ON source_evidence;
CREATE POLICY "Users manage own source_evidence"
  ON source_evidence FOR ALL TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Service role full access on source_evidence" ON source_evidence;
CREATE POLICY "Service role full access on source_evidence"
  ON source_evidence FOR ALL TO service_role
  USING (true) WITH CHECK (true);

COMMENT ON TABLE source_files IS
  'Uploaded source metadata and parsed text for global or session-scoped pipeline evidence.';

COMMENT ON TABLE source_evidence IS
  'Deterministically extracted evidence records derived from uploaded source files.';
