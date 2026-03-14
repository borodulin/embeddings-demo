ALTER TABLE documents
ADD COLUMN IF NOT EXISTS search_vector tsvector;

UPDATE documents
SET search_vector = to_tsvector('russian', COALESCE(path, ''))
WHERE search_vector IS NULL;

CREATE INDEX IF NOT EXISTS documents_search_vector_gin_idx
  ON documents
  USING gin (search_vector);

CREATE OR REPLACE FUNCTION documents_search_vector_update()
RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('russian', COALESCE(NEW.path, ''));
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS documents_search_vector_update_trigger ON documents;
CREATE TRIGGER documents_search_vector_update_trigger
BEFORE INSERT OR UPDATE OF path
ON documents
FOR EACH ROW
EXECUTE FUNCTION documents_search_vector_update();
