import { config } from "@/lib/config";

export const toVectorLiteral = (values: number[]) => `[${values.join(",")}]`;

export const ensureEmbeddingDim = (values: number[]) => {
  if (values.length !== config.embeddingDim) {
    throw new Error(`Embedding size mismatch: expected ${config.embeddingDim}, got ${values.length}`);
  }
};
