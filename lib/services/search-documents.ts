import { embedText } from "../embeddings";
import { searchDocumentsByEmbedding } from "../repositories/documents";
import { toVectorLiteral } from "../vector";

export type SearchResultItem = {
  id: number;
  path: string;
  title: string;
  snippet: string;
  score: number;
};

export const searchDocuments = async (
  query: string,
  limit: number,
): Promise<{ query: string; results: SearchResultItem[] }> => {
  const queryEmbedding = await embedText(query);
  const vectorLiteral = toVectorLiteral(queryEmbedding);
  const rows = await searchDocumentsByEmbedding(vectorLiteral, limit);

  return {
    query,
    results: rows.map((row) => ({
      id: row.id,
      path: row.path,
      title: row.title,
      snippet: row.snippet,
      score: Number(row.score),
    })),
  };
};
