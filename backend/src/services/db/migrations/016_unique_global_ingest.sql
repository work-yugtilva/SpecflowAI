-- Prevent duplicate global ingest entries on re-run.
-- Unique on (scope_key, title, type) so upsert can deduplicate by natural key.
-- Session-scoped rows use distinct scope_key values per session and won't collide.
CREATE UNIQUE INDEX IF NOT EXISTS research_entries_global_unique_idx
  ON research_entries (scope_key, title, type);
