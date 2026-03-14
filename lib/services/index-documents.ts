import { embedText } from "../embeddings";
import { EMBEDDING_MODELS, type EmbeddingModel } from "../models";
import {
  listDocumentsForModelIndexing,
  markModelVectorError,
  markModelVectorIndexed,
  markModelVectorIndexing,
  resetModelVectorsForDocument,
} from "../repositories/document-vectors";
import { upsertDocument } from "../repositories/documents";
import { toVectorLiteral } from "../vector";

export type DocumentToIndex = {
  path: string;
  chunkIndex: number;
  title: string;
};

type PerModelStats = Record<EmbeddingModel, number>;
type IndexModelBatchDoc = { documentId: number; path: string };

const emptyModelStats = (): PerModelStats => ({
  qwen3_embedding_0_6b: 0,
  gigachat: 0,
  text_embedding_3_small: 0,
});

const normalizeErrorMessage = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, 1000);
};

export const indexDocumentByModel = async (
  documentId: number,
  sourceText: string,
  model: EmbeddingModel,
): Promise<"indexed" | "error"> => {
  await markModelVectorIndexing(model, documentId);

  try {
    const embedding = await embedText(sourceText, model);
    const embeddingLiteral = toVectorLiteral(embedding);
    await markModelVectorIndexed(model, documentId, embeddingLiteral);
    return "indexed";
  } catch (error) {
    await markModelVectorError(model, documentId, normalizeErrorMessage(error));
    return "error";
  }
};

const indexModelBatch = async (
  model: EmbeddingModel,
  docs: IndexModelBatchDoc[],
): Promise<{ processed: number; indexed: number; failed: number }> => {
  let processed = 0;
  let indexed = 0;
  let failed = 0;

  for (const doc of docs) {
    const result = await indexDocumentByModel(doc.documentId, doc.path, model);
    processed += 1;
    if (result === "indexed") {
      indexed += 1;
    } else {
      failed += 1;
    }
  }

  return { processed, indexed, failed };
};

export const indexPendingVectorsByModel = async (params: {
  model: EmbeddingModel;
  batchSize: number;
  limitPerModel?: number;
  onBatch?: (stats: { model: EmbeddingModel; processed: number; indexed: number; failed: number }) => void;
}): Promise<{ processed: number; indexed: number; failed: number }> => {
  const { model, batchSize, limitPerModel, onBatch } = params;
  if (!Number.isFinite(batchSize) || batchSize <= 0) {
    throw new Error(`Invalid batchSize: ${batchSize}`);
  }

  let processed = 0;
  let indexed = 0;
  let failed = 0;

  while (!limitPerModel || processed < limitPerModel) {
    const take = limitPerModel ? Math.min(batchSize, Math.max(limitPerModel - processed, 0)) : batchSize;
    if (take <= 0) {
      break;
    }

    const rows = await listDocumentsForModelIndexing(model, take);
    if (rows.length === 0) {
      break;
    }

    const batchResult = await indexModelBatch(
      model,
      rows.map((row) => ({ documentId: row.id, path: row.path })),
    );

    processed += batchResult.processed;
    indexed += batchResult.indexed;
    failed += batchResult.failed;

    onBatch?.({ model, processed, indexed, failed });
  }

  return { processed, indexed, failed };
};

export const indexDocuments = async (
  documents: DocumentToIndex[],
): Promise<{ indexedByModel: PerModelStats; failedByModel: PerModelStats; documents: number }> => {
  const indexedByModel = emptyModelStats();
  const failedByModel = emptyModelStats();

  for (const doc of documents) {
    const documentId = await upsertDocument({
      path: doc.path,
      chunkIndex: doc.chunkIndex,
      title: doc.title,
    });
    await resetModelVectorsForDocument(documentId);

    for (const model of EMBEDDING_MODELS) {
      const result = await indexDocumentByModel(documentId, doc.path, model);
      if (result === "indexed") {
        indexedByModel[model] += 1;
      } else {
        failedByModel[model] += 1;
      }
    }
  }

  return {
    indexedByModel,
    failedByModel,
    documents: documents.length,
  };
};
