import { MODEL_DIMENSION_BY_NAME } from "./models";
import type { EmbeddingModel } from "./models";

export const toVectorLiteral = (values: number[]) => `[${values.join(",")}]`;

export const ensureEmbeddingDim = (values: number[], model: EmbeddingModel) => {
  const expectedDimension = MODEL_DIMENSION_BY_NAME[model];
  if (values.length !== expectedDimension) {
    throw new Error(`Embedding size mismatch for ${model}: expected ${expectedDimension}, got ${values.length}`);
  }
};
