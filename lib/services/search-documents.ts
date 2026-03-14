import { embedText } from "../embeddings";
import { EMBEDDING_MODELS, type EmbeddingModel } from "../models";
import { searchDocumentsByModel } from "../repositories/document-vectors";
import { toVectorLiteral } from "../vector";

export type SearchResultItem = {
  id: number;
  path: string;
  title: string;
  snippet: string;
  score: number;
};

export type SearchResultsByModel = Record<EmbeddingModel, SearchResultItem[]>;
export type SearchErrorsByModel = Record<EmbeddingModel, string | null>;

const emptyResultsByModel = (): SearchResultsByModel => ({
  qwen3_embedding_0_6b: [],
  gigachat: [],
  text_embedding_3_small: [],
});

const emptyErrorsByModel = (): SearchErrorsByModel => ({
  qwen3_embedding_0_6b: null,
  gigachat: null,
  text_embedding_3_small: null,
});

const normalizeErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "Search failed";

export const searchDocuments = async (
  query: string,
  limit: number,
): Promise<{ query: string; resultsByModel: SearchResultsByModel; errorsByModel: SearchErrorsByModel }> => {
  const resultsByModel = emptyResultsByModel();
  const errorsByModel = emptyErrorsByModel();

  await Promise.all(
    EMBEDDING_MODELS.map(async (model) => {
      try {
        const queryEmbedding = await embedText(query, model);
        const vectorLiteral = toVectorLiteral(queryEmbedding);
        const rows = await searchDocumentsByModel(model, vectorLiteral, limit);
        resultsByModel[model] = rows.map((row) => ({
          id: row.id,
          path: row.path,
          title: row.title,
          snippet: row.snippet,
          score: Number(row.score),
        }));
      } catch (error) {
        errorsByModel[model] = normalizeErrorMessage(error);
      }
    }),
  );

  return { query, resultsByModel, errorsByModel };
};
