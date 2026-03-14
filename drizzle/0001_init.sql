CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS documents (
  id BIGSERIAL PRIMARY KEY,
  path TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT documents_path_unique UNIQUE (path)
);

CREATE TABLE IF NOT EXISTS document_vectors_qwen3_embedding_0_6b (
  id BIGSERIAL PRIMARY KEY,
  document_id BIGINT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  embedding vector(1024),
  indexing_status TEXT NOT NULL DEFAULT 'pending',
  indexing_error TEXT,
  indexed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT document_vectors_qwen3_embedding_0_6b_document_unique UNIQUE (document_id)
);

CREATE INDEX IF NOT EXISTS document_vectors_qwen3_embedding_0_6b_embedding_ivfflat_idx
  ON document_vectors_qwen3_embedding_0_6b
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX IF NOT EXISTS document_vectors_qwen3_embedding_0_6b_indexing_status_idx
  ON document_vectors_qwen3_embedding_0_6b (indexing_status);

CREATE TABLE IF NOT EXISTS document_vectors_gigachat (
  id BIGSERIAL PRIMARY KEY,
  document_id BIGINT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  embedding vector(1024),
  indexing_status TEXT NOT NULL DEFAULT 'pending',
  indexing_error TEXT,
  indexed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT document_vectors_gigachat_document_unique UNIQUE (document_id)
);

CREATE INDEX IF NOT EXISTS document_vectors_gigachat_embedding_ivfflat_idx
  ON document_vectors_gigachat
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX IF NOT EXISTS document_vectors_gigachat_indexing_status_idx
  ON document_vectors_gigachat (indexing_status);

CREATE TABLE IF NOT EXISTS document_vectors_text_embedding_3_small (
  id BIGSERIAL PRIMARY KEY,
  document_id BIGINT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  embedding vector(1536),
  indexing_status TEXT NOT NULL DEFAULT 'pending',
  indexing_error TEXT,
  indexed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT document_vectors_text_embedding_3_small_document_unique UNIQUE (document_id)
);

CREATE INDEX IF NOT EXISTS document_vectors_text_embedding_3_small_embedding_ivfflat_idx
  ON document_vectors_text_embedding_3_small
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX IF NOT EXISTS document_vectors_text_embedding_3_small_indexing_status_idx
  ON document_vectors_text_embedding_3_small (indexing_status);
