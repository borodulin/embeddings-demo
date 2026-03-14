import { embedText } from "../embeddings";
import { upsertIndexedDocument } from "../repositories/documents";
import { toVectorLiteral } from "../vector";

export type DocumentToIndex = {
  path: string;
  chunkIndex: number;
  title: string;
};

export const indexDocuments = async (documents: DocumentToIndex[]): Promise<{ indexed: number }> => {
  let indexed = 0;

  for (const doc of documents) {
    const embedding = await embedText(doc.path);
    const embeddingLiteral = toVectorLiteral(embedding);

    await upsertIndexedDocument({
      path: doc.path,
      chunkIndex: doc.chunkIndex,
      title: doc.title,
      embeddingLiteral,
    });

    indexed += 1;
  }

  return { indexed };
};
