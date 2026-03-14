const toInt = (value: string | undefined, fallback: number) => {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const config = {
  databaseUrl: process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/embeddings_demo",
  embeddingsApiUrl: process.env.EMBEDDINGS_API_URL ?? "http://localhost:8080",
  embeddingDim: toInt(process.env.EMBEDDING_DIM, 1024),
};
