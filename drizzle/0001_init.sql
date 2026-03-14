CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS documents (
  id BIGSERIAL PRIMARY KEY,
  source TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  embedding vector(1024) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT documents_source_chunk_unique UNIQUE (source, chunk_index)
);

CREATE INDEX IF NOT EXISTS documents_embedding_ivfflat_idx
  ON documents
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
