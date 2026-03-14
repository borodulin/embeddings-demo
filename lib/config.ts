import { EMBEDDING_DIM } from "./constants";

const toInt = (value: string | undefined, fallback: number) => {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const embeddingDim = toInt(process.env.EMBEDDING_DIM, EMBEDDING_DIM);

if (embeddingDim !== EMBEDDING_DIM) {
  throw new Error(
    `EMBEDDING_DIM=${embeddingDim} does not match schema dimension ${EMBEDDING_DIM}. Update DB schema/migrations first.`,
  );
}

export const config = {
  databaseUrl: process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/embeddings_demo",
  embeddingsApiUrl: process.env.EMBEDDINGS_API_URL ?? "http://localhost:8080",
  embeddingDim,
};
