import { EmbeddingModel } from "./models";

const defaultEmbeddingsApiUrl = process.env.EMBEDDINGS_API_URL ?? "http://localhost:8080";
const defaultGigaChatApiUrl = "https://gigachat.devices.sberbank.ru/api/v1";
const defaultGigaChatOauthUrl = "https://ngw.devices.sberbank.ru:9443/api/v2/oauth";
const defaultOpenAiApiUrl = "https://api.openai.com";

export const config = {
  databaseUrl: process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/embeddings_demo",
  embeddingsApiUrls: {
    qwen3_embedding_0_6b: process.env.EMBEDDINGS_API_URL_QWEN3_EMBEDDING_0_6B ?? defaultEmbeddingsApiUrl,
    gigachat: process.env.EMBEDDINGS_API_URL_GIGACHAT ?? defaultGigaChatApiUrl,
    text_embedding_3_small: process.env.EMBEDDINGS_API_URL_OPENAI ?? defaultOpenAiApiUrl,
  } satisfies Record<EmbeddingModel, string>,
  embeddingsProviderModelNames: {
    qwen3_embedding_0_6b:
      process.env.EMBEDDINGS_MODEL_QWEN3_EMBEDDING_0_6B ?? "Qwen/Qwen3-Embedding-0.6B",
    gigachat: process.env.EMBEDDINGS_MODEL_GIGACHAT ?? "EmbeddingsGigaR",
    text_embedding_3_small: process.env.EMBEDDINGS_MODEL_OPENAI ?? "text-embedding-3-small",
  } satisfies Record<EmbeddingModel, string>,
  openAiApiKey: process.env.OPENAI_API_KEY,
  openAiOrganization: process.env.OPENAI_ORGANIZATION,
  openAiProxyUrl: process.env.OPENAI_PROXY_URL,
  gigaChatAuthKey: process.env.GIGACHAT_AUTH_KEY,
  gigaChatScope: process.env.GIGACHAT_SCOPE ?? "GIGACHAT_API_PERS",
  gigaChatOauthUrl: process.env.GIGACHAT_OAUTH_URL ?? defaultGigaChatOauthUrl,
};
