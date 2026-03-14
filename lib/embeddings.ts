import { config } from "./config";
import type { EmbeddingModel } from "./models";
import { ensureEmbeddingDim } from "./vector";
import { embedWithGigaChatProvider } from "./embeddings/providers/gigachat";
import { embedWithOpenAiProvider } from "./embeddings/providers/openai";
import { embedWithQwenProvider } from "./embeddings/providers/qwen";

const normalizeVector = (value: unknown, model: EmbeddingModel): number[] => {
  if (!Array.isArray(value)) {
    throw new Error("Embedding response is not an array");
  }

  const first = value[0];
  const source =
    Array.isArray(first) && first.length > 0 && first.every((item) => typeof item === "number")
      ? first
      : value;

  const numbers = source.map((item) => Number(item));
  if (numbers.some((item) => Number.isNaN(item))) {
    throw new Error("Embedding contains non-numeric values");
  }

  ensureEmbeddingDim(numbers, model);
  return numbers;
};

export const embedText = async (input: string, model: EmbeddingModel): Promise<number[]> => {
  switch (model) {
    case "qwen3_embedding_0_6b":
      return normalizeVector(
        await embedWithQwenProvider({
          baseUrl: config.embeddingsApiUrls.qwen3_embedding_0_6b,
          input,
          modelName: config.embeddingsProviderModelNames.qwen3_embedding_0_6b,
        }),
        model,
      );
    case "gigachat":
      return normalizeVector(
        await embedWithGigaChatProvider({
          apiUrl: config.embeddingsApiUrls.gigachat,
          oauthUrl: config.gigaChatOauthUrl,
          authKey: config.gigaChatAuthKey,
          scope: config.gigaChatScope,
          modelName: config.embeddingsProviderModelNames.gigachat,
          input,
        }),
        model,
      );
    case "text_embedding_3_small":
      return normalizeVector(
        await embedWithOpenAiProvider({
          baseUrl: config.embeddingsApiUrls.text_embedding_3_small,
          proxyUrl: config.openAiProxyUrl,
          input,
          modelName: config.embeddingsProviderModelNames.text_embedding_3_small,
          apiKey: config.openAiApiKey,
          organization: config.openAiOrganization,
        }),
        model,
      );
  }
};
