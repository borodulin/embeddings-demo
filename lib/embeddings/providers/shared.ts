export const toUrl = (baseUrl: string, path: string) => `${baseUrl.replace(/\/$/, "")}${path}`;

export const fromOpenAiLikePayload = (payload: unknown): unknown => {
  if (!payload || typeof payload !== "object") {
    return undefined;
  }

  const data = (payload as { data?: unknown }).data;
  if (!Array.isArray(data) || data.length === 0) {
    return undefined;
  }

  const first = data[0];
  if (!first || typeof first !== "object") {
    return undefined;
  }

  return (first as { embedding?: unknown }).embedding;
};

type OpenAiCompatibleParams = {
  baseUrl: string;
  input: string;
  modelName: string;
  headers?: Record<string, string>;
  extractEmbedding?: (payload: unknown) => unknown;
};

export const requestOpenAiCompatibleEmbedding = async ({
  baseUrl,
  input,
  modelName,
  headers,
  extractEmbedding,
}: OpenAiCompatibleParams): Promise<unknown> => {
  const response = await fetch(toUrl(baseUrl, "/v1/embeddings"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(headers ?? {}),
    },
    body: JSON.stringify({
      input,
      model: modelName,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Embeddings API error: ${response.status} ${errorText}`);
  }

  const payload = (await response.json()) as unknown;
  return extractEmbedding ? extractEmbedding(payload) : fromOpenAiLikePayload(payload);
};

type TeiParams = {
  baseUrl: string;
  input: string;
};

export const requestTeiEmbedding = async ({ baseUrl, input }: TeiParams): Promise<unknown | null> => {
  const teiResponse = await fetch(toUrl(baseUrl, "/embed"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ inputs: input }),
    cache: "no-store",
  });

  if (!teiResponse.ok) {
    return null;
  }

  return (await teiResponse.json()) as unknown;
};
