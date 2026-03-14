import { sql } from "../db";

type UpsertDocumentParams = {
  path: string;
  chunkIndex: number;
  title: string;
};

export type SearchRow = {
  id: number;
  path: string;
  title: string;
  snippet: string;
  score: number;
};

export const upsertDocument = async (params: UpsertDocumentParams): Promise<number> => {
  const rows = await sql<{ id: number }[]>`
    INSERT INTO documents (path, chunk_index, title)
    VALUES (${params.path}, ${params.chunkIndex}, ${params.title})
    ON CONFLICT (path)
    DO UPDATE SET
      chunk_index = EXCLUDED.chunk_index,
      title = EXCLUDED.title
    RETURNING id
  `;

  return rows[0].id;
};

export const searchDocumentsFullText = async (query: string, limit: number): Promise<SearchRow[]> => {
  const rows = await sql<SearchRow[]>`
    SELECT
      id,
      path,
      title,
      LEFT(path, 220) AS snippet,
      ts_rank(search_vector, plainto_tsquery('russian', ${query})) AS score
    FROM documents
    WHERE search_vector @@ plainto_tsquery('russian', ${query})
    ORDER BY score DESC, id ASC
    LIMIT ${limit}
  `;

  return rows.map((row) => ({
    ...row,
    score: Number(row.score),
  }));
};
