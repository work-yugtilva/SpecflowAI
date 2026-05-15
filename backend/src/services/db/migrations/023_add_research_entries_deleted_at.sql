ALTER TABLE research_entries
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

DROP INDEX IF EXISTS research_entries_global_unique_idx;

CREATE UNIQUE INDEX IF NOT EXISTS research_entries_global_unique_idx
  ON research_entries (scope_key, title, type)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS research_entries_active_scope_idx
  ON research_entries(user_id, scope_key, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION match_research_entries(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  filter_user_id text DEFAULT NULL,
  filter_session_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  title text,
  content text,
  type text,
  context_text text,
  tags jsonb,
  scope text,
  session_id uuid,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id,
    r.title,
    r.content,
    r.type,
    r.context_text,
    r.tags,
    r.scope,
    r.session_id,
    1 - (r.embedding <=> query_embedding) AS similarity
  FROM research_entries r
  WHERE
    r.deleted_at IS NULL
    AND r.embedding IS NOT NULL
    AND 1 - (r.embedding <=> query_embedding) > match_threshold
    AND (filter_user_id IS NULL OR r.user_id = filter_user_id)
    AND (filter_session_id IS NULL OR r.session_id = filter_session_id)
  ORDER BY r.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
