import "./_shared/env";

import { EMBEDDING_MODELS, isEmbeddingModel, type EmbeddingModel } from "../lib/models";
import { indexPendingVectorsByModel } from "../lib/services/index-documents";
import { getArg, parseOptionalIntArg, toInt } from "./_shared/cli";

const scriptConfig = {
  batchSize: toInt(process.env.INDEX_BATCH_SIZE, 50),
};

const args = process.argv.slice(2);

const limitArg = getArg(args, "--limit");
const limitPerModelArg = getArg(args, "--limit-per-model");
const limitPerModel = parseOptionalIntArg(limitPerModelArg ?? limitArg);
const modelArg = getArg(args, "--model");

const batchArg = getArg(args, "--batch");
const batchSize = parseOptionalIntArg(batchArg) ?? scriptConfig.batchSize;

async function main() {
  if (!Number.isFinite(batchSize) || batchSize <= 0) {
    throw new Error(`Invalid --batch value: ${batchArg}`);
  }

  if (modelArg && !isEmbeddingModel(modelArg)) {
    throw new Error(
      `Invalid --model value: ${modelArg}. Allowed: ${EMBEDDING_MODELS.join(", ")}`,
    );
  }

  const modelsToIndex: EmbeddingModel[] = modelArg ? [modelArg] : [...EMBEDDING_MODELS];

  let processedTotal = 0;
  const indexedByModel: Record<EmbeddingModel, number> = {
    qwen3_embedding_0_6b: 0,
    gigachat: 0,
    text_embedding_3_small: 0,
  };
  const failedByModel: Record<EmbeddingModel, number> = {
    qwen3_embedding_0_6b: 0,
    gigachat: 0,
    text_embedding_3_small: 0,
  };

  for (const model of modelsToIndex) {
    const modelResult = await indexPendingVectorsByModel({
      model,
      batchSize,
      limitPerModel,
    });

    indexedByModel[model] = modelResult.indexed;
    failedByModel[model] = modelResult.failed;
    processedTotal += modelResult.processed;
    console.log(`Model ${model}: processed=${modelResult.processed}, indexed=${modelResult.indexed}, failed=${modelResult.failed}`);
  }

  console.log(
    `Vector indexing finished. Processed: ${processedTotal}, qwen(indexed:${indexedByModel.qwen3_embedding_0_6b},failed:${failedByModel.qwen3_embedding_0_6b}), gigachat(indexed:${indexedByModel.gigachat},failed:${failedByModel.gigachat}), text-embedding-3-small(indexed:${indexedByModel.text_embedding_3_small},failed:${failedByModel.text_embedding_3_small})`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
