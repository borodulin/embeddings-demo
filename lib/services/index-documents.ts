import { embedText, embedTexts } from "../embeddings";
import { EMBEDDING_MODELS, type EmbeddingModel } from "../models";
import {
  claimDocumentsForModelIndexing,
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

const DEFAULT_INDEX_CONCURRENCY = 8;
const MAX_INDEX_CONCURRENCY = 32;
const DEFAULT_OPENAI_EMBED_BATCH_SIZE = 16;
const MAX_OPENAI_EMBED_BATCH_SIZE = 128;

const emptyModelStats = (): PerModelStats => ({
  qwen3_embedding_0_6b: 0,
  gigachat: 0,
  text_embedding_3_small: 0,
});

const normalizeErrorMessage = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, 1000);
};

const resolveIndexConcurrency = (): number => {
  const raw = process.env.INDEX_CONCURRENCY;
  const parsed = raw ? Number.parseInt(raw, 10) : DEFAULT_INDEX_CONCURRENCY;
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_INDEX_CONCURRENCY;
  }

  return Math.min(parsed, MAX_INDEX_CONCURRENCY);
};

const resolveOpenAiEmbedBatchSize = (): number => {
  const raw = process.env.OPENAI_EMBED_BATCH_SIZE;
  const parsed = raw ? Number.parseInt(raw, 10) : DEFAULT_OPENAI_EMBED_BATCH_SIZE;
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_OPENAI_EMBED_BATCH_SIZE;
  }

  return Math.min(parsed, MAX_OPENAI_EMBED_BATCH_SIZE);
};

export const indexDocumentByModel = async (
  documentId: number,
  sourceText: string,
  model: EmbeddingModel,
  options?: { alreadyIndexing?: boolean },
): Promise<"indexed" | "error"> => {
  if (!options?.alreadyIndexing) {
    await markModelVectorIndexing(model, documentId);
  }

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

const indexOpenAiModelBatch = async (
  docs: IndexModelBatchDoc[],
): Promise<{ processed: number; indexed: number; failed: number }> => {
  const embedBatchSize = Math.min(resolveOpenAiEmbedBatchSize(), docs.length || 1);
  let processed = 0;
  let indexed = 0;
  let failed = 0;

  for (let offset = 0; offset < docs.length; offset += embedBatchSize) {
    const chunk = docs.slice(offset, offset + embedBatchSize);
    try {
      const embeddings = await embedTexts(
        chunk.map((doc) => doc.path),
        "text_embedding_3_small",
      );

      await Promise.all(
        chunk.map((doc, idx) =>
          markModelVectorIndexed(
            "text_embedding_3_small",
            doc.documentId,
            toVectorLiteral(embeddings[idx]),
          ),
        ),
      );

      processed += chunk.length;
      indexed += chunk.length;
    } catch {
      // If a whole batch fails, retry documents one-by-one to isolate transient failures.
      for (const doc of chunk) {
        const result = await indexDocumentByModel(
          doc.documentId,
          doc.path,
          "text_embedding_3_small",
          { alreadyIndexing: true },
        );
        processed += 1;
        if (result === "indexed") {
          indexed += 1;
        } else {
          failed += 1;
        }
      }
    }
  }

  return { processed, indexed, failed };
};

const indexModelBatch = async (
  model: EmbeddingModel,
  docs: IndexModelBatchDoc[],
): Promise<{ processed: number; indexed: number; failed: number }> => {
  if (model === "text_embedding_3_small") {
    return indexOpenAiModelBatch(docs);
  }

  const concurrency = Math.min(resolveIndexConcurrency(), docs.length || 1);
  let processed = 0;
  let indexed = 0;
  let failed = 0;
  let cursor = 0;

  const runWorker = async () => {
    while (cursor < docs.length) {
      const currentIndex = cursor;
      cursor += 1;
      const doc = docs[currentIndex];

      const result = await indexDocumentByModel(doc.documentId, doc.path, model, { alreadyIndexing: true });
      processed += 1;
      if (result === "indexed") {
        indexed += 1;
      } else {
        failed += 1;
      }
    }
  };

  await Promise.all(Array.from({ length: concurrency }, () => runWorker()));

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

    const rows = await claimDocumentsForModelIndexing(model, take);
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
