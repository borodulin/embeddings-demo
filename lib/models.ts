import { MODEL_DIMENSIONS } from "./constants";

export const EMBEDDING_MODELS = ["qwen3_embedding_0_6b", "gigachat", "text_embedding_3_small"] as const;

export type EmbeddingModel = (typeof EMBEDDING_MODELS)[number];

export const isEmbeddingModel = (value: string): value is EmbeddingModel =>
  EMBEDDING_MODELS.includes(value as EmbeddingModel);

export const MODEL_DIMENSION_BY_NAME: Record<EmbeddingModel, number> = MODEL_DIMENSIONS;
