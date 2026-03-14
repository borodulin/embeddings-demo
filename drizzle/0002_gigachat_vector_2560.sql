DROP INDEX IF EXISTS document_vectors_gigachat_embedding_ivfflat_idx;

UPDATE document_vectors_gigachat
SET
  embedding = NULL,
  indexing_status = 'pending',
  indexing_error = NULL,
  indexed_at = NULL
WHERE embedding IS NOT NULL;

ALTER TABLE document_vectors_gigachat
ALTER COLUMN embedding TYPE vector(2560);
