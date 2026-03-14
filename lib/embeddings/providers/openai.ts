import { requestOpenAiCompatibleEmbedding } from "./shared";

type OpenAiProviderParams = {
  baseUrl: string;
  proxyUrl?: string;
  input: string;
  modelName: string;
  apiKey?: string;
  organization?: string;
};

export const embedWithOpenAiProvider = async ({
  baseUrl,
  proxyUrl,
  input,
  modelName,
  apiKey,
  organization,
}: OpenAiProviderParams): Promise<unknown> => {
  const targetBaseUrl = (proxyUrl ?? baseUrl).replace(/\/$/, "");

  if (!apiKey && !proxyUrl) {
    throw new Error("OPENAI_API_KEY is required for direct openai integration");
  }

  const headers: Record<string, string> = {};
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }
  if (organization) {
    headers["OpenAI-Organization"] = organization;
  }

  return requestOpenAiCompatibleEmbedding({
    baseUrl: targetBaseUrl,
    input,
    modelName,
    headers,
  });
};
