import { ProxyAgent } from "undici";

import { requestOpenAiCompatibleEmbedding, requestOpenAiCompatibleEmbeddings } from "./shared";

type OpenAiProviderParams = {
  baseUrl: string;
  proxyUrl?: string;
  input: string;
  modelName: string;
  apiKey?: string;
  organization?: string;
};

const proxyAgentCache = new Map<string, ProxyAgent>();

const normalizeProxyUrl = (rawProxyUrl: string): string => {
  let parsed: URL;
  try {
    parsed = new URL(rawProxyUrl);
  } catch {
    throw new Error(`Invalid OPENAI_PROXY_URL value: ${rawProxyUrl}`);
  }
  return parsed.toString().replace(/\/$/, "");
};

const getProxyAgent = (proxyUrl: string): ProxyAgent => {
  const cached = proxyAgentCache.get(proxyUrl);
  if (cached) {
    return cached;
  }

  const agent = new ProxyAgent(proxyUrl);
  proxyAgentCache.set(proxyUrl, agent);
  return agent;
};

export const closeOpenAiProxyAgents = async (): Promise<void> => {
  const agents = Array.from(proxyAgentCache.values());
  proxyAgentCache.clear();

  await Promise.allSettled(
    agents.map(async (agent) => {
      try {
        await agent.close();
      } catch {
        agent.destroy();
      }
    }),
  );
};

export const embedWithOpenAiProvider = async ({
  baseUrl,
  proxyUrl,
  input,
  modelName,
  apiKey,
  organization,
}: OpenAiProviderParams): Promise<unknown> => {
  const normalizedProxyUrl = proxyUrl ? normalizeProxyUrl(proxyUrl) : undefined;
  const targetBaseUrl = baseUrl.replace(/\/$/, "");

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
    requestInit: normalizedProxyUrl
      ? ({
          dispatcher: getProxyAgent(normalizedProxyUrl),
        } as RequestInit & { dispatcher: unknown })
      : undefined,
  });
};

export const embedManyWithOpenAiProvider = async ({
  baseUrl,
  proxyUrl,
  input,
  modelName,
  apiKey,
  organization,
}: Omit<OpenAiProviderParams, "input"> & { input: string[] }): Promise<unknown[] | undefined> => {
  const normalizedProxyUrl = proxyUrl ? normalizeProxyUrl(proxyUrl) : undefined;
  const targetBaseUrl = baseUrl.replace(/\/$/, "");

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

  return requestOpenAiCompatibleEmbeddings({
    baseUrl: targetBaseUrl,
    input,
    modelName,
    headers,
    requestInit: normalizedProxyUrl
      ? ({
          dispatcher: getProxyAgent(normalizedProxyUrl),
        } as RequestInit & { dispatcher: unknown })
      : undefined,
  });
};
