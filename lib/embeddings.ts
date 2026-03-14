import { config } from "./config";
import { ensureEmbeddingDim } from "./vector";

const normalizeVector = (value: unknown): number[] => {
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

  ensureEmbeddingDim(numbers);
  return numbers;
};

export const embedText = async (input: string): Promise<number[]> => {
  const baseUrl = config.embeddingsApiUrl.replace(/\/$/, "");

  const teiResponse = await fetch(`${baseUrl}/embed`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ inputs: input }),
    cache: "no-store",
  });

  if (teiResponse.ok) {
    const payload = (await teiResponse.json()) as unknown;
    return normalizeVector(payload);
  }

  const openAiCompatResponse = await fetch(`${baseUrl}/v1/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ input, model: "local" }),
    cache: "no-store",
  });

  if (!openAiCompatResponse.ok) {
    const errorText = await openAiCompatResponse.text();
    throw new Error(`Embeddings API error: ${openAiCompatResponse.status} ${errorText}`);
  }

  const payload = (await openAiCompatResponse.json()) as {
    data?: Array<{ embedding?: unknown }>;
  };
  const vector = payload.data?.[0]?.embedding;
  return normalizeVector(vector);
};
