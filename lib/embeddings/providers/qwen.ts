import { requestOpenAiCompatibleEmbedding, requestTeiEmbedding } from "./shared";

type QwenProviderParams = {
  baseUrl: string;
  input: string;
  modelName: string;
};

export const embedWithQwenProvider = async ({
  baseUrl,
  input,
  modelName,
}: QwenProviderParams): Promise<unknown> => {
  const teiEmbedding = await requestTeiEmbedding({ baseUrl, input });
  if (teiEmbedding) {
    return teiEmbedding;
  }

  return requestOpenAiCompatibleEmbedding({
    baseUrl,
    input,
    modelName,
  });
};
