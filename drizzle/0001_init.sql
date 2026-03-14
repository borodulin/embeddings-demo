CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS documents (
  id BIGSERIAL PRIMARY KEY,
  path TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  embedding vector(1024),
  indexing_status TEXT NOT NULL DEFAULT 'pending',
  indexing_error TEXT,
  indexed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT documents_path_unique UNIQUE (path)
);

CREATE INDEX IF NOT EXISTS documents_embedding_ivfflat_idx
  ON documents
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX IF NOT EXISTS documents_indexing_status_idx
  ON documents (indexing_status);
