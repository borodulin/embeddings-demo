import { toUrl, fromOpenAiLikePayload } from "./shared";

type GigaChatProviderParams = {
  apiUrl: string;
  oauthUrl: string;
  authKey?: string;
  scope: string;
  modelName: string;
  input: string;
};

let gigaChatTokenCache: { accessToken: string; expiresAtMs: number } | null = null;

const getGigaChatToken = async ({
  oauthUrl,
  authKey,
  scope,
}: {
  oauthUrl: string;
  authKey?: string;
  scope: string;
}): Promise<string> => {
  if (gigaChatTokenCache && gigaChatTokenCache.expiresAtMs > Date.now() + 10_000) {
    return gigaChatTokenCache.accessToken;
  }

  if (!authKey) {
    throw new Error("GIGACHAT_AUTH_KEY is required for gigachat integration");
  }

  const authHeader = authKey.startsWith("Basic ") ? authKey : `Basic ${authKey}`;

  const oauthResponse = await fetch(oauthUrl, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      RqUID: crypto.randomUUID().replace(/-/g, ""),
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: `scope=${encodeURIComponent(scope)}`,
    cache: "no-store",
  });

  if (!oauthResponse.ok) {
    const errorText = await oauthResponse.text();
    throw new Error(`GigaChat OAuth error: ${oauthResponse.status} ${errorText}`);
  }

  const payload = (await oauthResponse.json()) as {
    access_token?: string;
    expires_at?: number;
    expires_in?: number;
  };

  const accessToken = payload.access_token;
  if (!accessToken) {
    throw new Error("GigaChat OAuth error: empty access token");
  }

  const expiresAtMs = payload.expires_at
    ? Number(payload.expires_at)
    : payload.expires_in
      ? Date.now() + Number(payload.expires_in) * 1000
      : Date.now() + 25 * 60 * 1000;

  gigaChatTokenCache = {
    accessToken,
    expiresAtMs: Number.isFinite(expiresAtMs) ? expiresAtMs : Date.now() + 25 * 60 * 1000,
  };

  return accessToken;
};

export const embedWithGigaChatProvider = async ({
  apiUrl,
  oauthUrl,
  authKey,
  scope,
  modelName,
  input,
}: GigaChatProviderParams): Promise<unknown> => {
  const token = await getGigaChatToken({ oauthUrl, authKey, scope });
  const response = await fetch(toUrl(apiUrl, "/embeddings"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    body: JSON.stringify({
      model: modelName,
      input: [input],
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GigaChat embeddings error: ${response.status} ${errorText}`);
  }

  const payload = (await response.json()) as unknown;
  return fromOpenAiLikePayload(payload);
};
