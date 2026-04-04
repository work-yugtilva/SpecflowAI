-- Enable pgvector extension
create extension if not exists vector;

-- Add embedding column to research_entries
alter table research_entries
  add column if not exists embedding vector(1536);

-- Index for fast similarity search (cosine distance)
create index if not exists research_entries_embedding_idx
  on research_entries
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- Similarity search function
create or replace function match_research_entries(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  filter_user_id text default null,
  filter_session_id uuid default null
)
returns table (
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
language plpgsql
as $$
begin
  return query
  select
    r.id,
    r.title,
    r.content,
    r.type,
    r.context_text,
    r.tags,
    r.scope,
    r.session_id,
    1 - (r.embedding <=> query_embedding) as similarity
  from research_entries r
  where
    r.embedding is not null
    and 1 - (r.embedding <=> query_embedding) > match_threshold
    and (filter_user_id is null or r.user_id = filter_user_id)
    and (filter_session_id is null or r.session_id = filter_session_id)
  order by r.embedding <=> query_embedding
  limit match_count;
end;
$$;
