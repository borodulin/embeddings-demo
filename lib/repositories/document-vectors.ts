import type { EmbeddingModel } from "../models";
import { sql } from "../db";

type DocumentIndexRow = {
  id: number;
  path: string;
  title: string;
};

export type SearchRow = {
  id: number;
  path: string;
  title: string;
  snippet: string;
  score: number;
};

const VECTOR_TABLE_BY_MODEL: Record<EmbeddingModel, string> = {
  qwen3_embedding_0_6b: "document_vectors_qwen3_embedding_0_6b",
  gigachat: "document_vectors_gigachat",
  text_embedding_3_small: "document_vectors_text_embedding_3_small",
};

const upsertVectorRowPending = async (tableName: string, documentId: number): Promise<void> => {
  await sql.unsafe(
    `
      INSERT INTO ${tableName} (document_id, embedding, indexing_status, indexing_error, indexed_at)
      VALUES ($1, NULL, 'pending', NULL, NULL)
      ON CONFLICT (document_id)
      DO UPDATE SET
        embedding = NULL,
        indexing_status = 'pending',
        indexing_error = NULL,
        indexed_at = NULL
    `,
    [documentId],
  );
};

const markVectorRowIndexing = async (tableName: string, documentId: number): Promise<void> => {
  await sql.unsafe(
    `
      UPDATE ${tableName}
      SET indexing_status = 'indexing',
          indexing_error = NULL
      WHERE document_id = $1
    `,
    [documentId],
  );
};

const markVectorRowIndexed = async (
  tableName: string,
  documentId: number,
  embeddingLiteral: string,
): Promise<void> => {
  await sql.unsafe(
    `
      UPDATE ${tableName}
      SET embedding = $2::vector,
          indexing_status = 'indexed',
          indexing_error = NULL,
          indexed_at = NOW()
      WHERE document_id = $1
    `,
    [documentId, embeddingLiteral],
  );
};

const markVectorRowError = async (tableName: string, documentId: number, indexingError: string): Promise<void> => {
  await sql.unsafe(
    `
      UPDATE ${tableName}
      SET indexing_status = 'error',
          indexing_error = $2
      WHERE document_id = $1
    `,
    [documentId, indexingError],
  );
};

const listDocumentsForModelIndexingInternal = async (
  tableName: string,
  limit: number,
): Promise<DocumentIndexRow[]> =>
  sql.unsafe(
    `
      SELECT d.id, d.path, d.title
      FROM documents d
      JOIN ${tableName} v ON v.document_id = d.id
      WHERE v.embedding IS NULL
        AND v.indexing_status IN ('pending', 'error')
      ORDER BY d.id
      LIMIT $1
    `,
    [limit],
  ) as Promise<DocumentIndexRow[]>;

const claimDocumentsForModelIndexingInternal = async (
  tableName: string,
  limit: number,
): Promise<DocumentIndexRow[]> =>
  sql.unsafe(
    `
      WITH claimed AS (
        SELECT v.document_id
        FROM ${tableName} v
        WHERE v.embedding IS NULL
          AND v.indexing_status IN ('pending', 'error')
        ORDER BY v.document_id
        FOR UPDATE SKIP LOCKED
        LIMIT $1
      ),
      marked AS (
        UPDATE ${tableName} v
        SET indexing_status = 'indexing',
            indexing_error = NULL
        FROM claimed c
        WHERE v.document_id = c.document_id
        RETURNING v.document_id
      )
      SELECT d.id, d.path, d.title
      FROM marked m
      JOIN documents d ON d.id = m.document_id
      ORDER BY d.id
    `,
    [limit],
  ) as Promise<DocumentIndexRow[]>;

const searchDocumentsByModelInternal = async (
  tableName: string,
  embeddingLiteral: string,
  limit: number,
): Promise<SearchRow[]> =>
  sql.unsafe(
    `
      SELECT
        d.id,
        d.path,
        d.title,
        LEFT(d.path, 220) AS snippet,
        1 - (v.embedding <=> $1::vector) AS score
      FROM documents d
      JOIN ${tableName} v ON v.document_id = d.id
      WHERE v.embedding IS NOT NULL
        AND v.indexing_status = 'indexed'
      ORDER BY v.embedding <=> $1::vector
      LIMIT $2
    `,
    [embeddingLiteral, limit],
  ) as Promise<SearchRow[]>;

const getVectorTableName = (model: EmbeddingModel): string => VECTOR_TABLE_BY_MODEL[model];

export const resetModelVectorsForDocument = async (documentId: number): Promise<void> => {
  await Promise.all([
    upsertVectorRowPending(getVectorTableName("qwen3_embedding_0_6b"), documentId),
    upsertVectorRowPending(getVectorTableName("gigachat"), documentId),
    upsertVectorRowPending(getVectorTableName("text_embedding_3_small"), documentId),
  ]);
};

export const markModelVectorIndexing = async (model: EmbeddingModel, documentId: number): Promise<void> =>
  markVectorRowIndexing(getVectorTableName(model), documentId);

export const markModelVectorIndexed = async (
  model: EmbeddingModel,
  documentId: number,
  embeddingLiteral: string,
): Promise<void> => markVectorRowIndexed(getVectorTableName(model), documentId, embeddingLiteral);

export const markModelVectorError = async (
  model: EmbeddingModel,
  documentId: number,
  indexingError: string,
): Promise<void> => markVectorRowError(getVectorTableName(model), documentId, indexingError);

export const listDocumentsForModelIndexing = async (
  model: EmbeddingModel,
  limit: number,
): Promise<DocumentIndexRow[]> => listDocumentsForModelIndexingInternal(getVectorTableName(model), limit);

export const claimDocumentsForModelIndexing = async (
  model: EmbeddingModel,
  limit: number,
): Promise<DocumentIndexRow[]> => claimDocumentsForModelIndexingInternal(getVectorTableName(model), limit);

export const searchDocumentsByModel = async (
  model: EmbeddingModel,
  embeddingLiteral: string,
  limit: number,
): Promise<SearchRow[]> => searchDocumentsByModelInternal(getVectorTableName(model), embeddingLiteral, limit);
