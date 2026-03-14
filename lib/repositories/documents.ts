import { sql } from "../db";

type UpsertDocumentParams = {
  path: string;
  chunkIndex: number;
  title: string;
  embeddingLiteral: string;
};

export type SearchRow = {
  id: number;
  path: string;
  title: string;
  snippet: string;
  score: number;
};

export const upsertIndexedDocument = async (params: UpsertDocumentParams): Promise<void> => {
  await sql`
    INSERT INTO documents (path, chunk_index, title, embedding, indexing_status, indexing_error, indexed_at)
    VALUES (
      ${params.path},
      ${params.chunkIndex},
      ${params.title},
      ${params.embeddingLiteral}::vector,
      'indexed',
      NULL,
      NOW()
    )
    ON CONFLICT (path)
    DO UPDATE SET
      chunk_index = EXCLUDED.chunk_index,
      title = EXCLUDED.title,
      embedding = EXCLUDED.embedding,
      indexing_status = 'indexed',
      indexing_error = NULL,
      indexed_at = NOW()
  `;
};

export const searchDocumentsByEmbedding = async (
  embeddingLiteral: string,
  limit: number,
): Promise<SearchRow[]> =>
  sql<SearchRow[]>`
    SELECT
      id,
      path,
      title,
      LEFT(path, 220) AS snippet,
      1 - (embedding <=> ${embeddingLiteral}::vector) AS score
    FROM documents
    WHERE embedding IS NOT NULL
      AND indexing_status = 'indexed'
    ORDER BY embedding <=> ${embeddingLiteral}::vector
    LIMIT ${limit}
  `;
