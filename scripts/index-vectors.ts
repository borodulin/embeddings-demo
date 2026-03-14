import postgres from "postgres";

type DocumentRow = {
  id: number;
  path: string;
};

const toInt = (value: string | undefined, fallback: number): number => {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const config = {
  databaseUrl: process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/embeddings_demo",
  embeddingsApiUrl: process.env.EMBEDDINGS_API_URL ?? "http://localhost:8080",
  embeddingDim: toInt(process.env.EMBEDDING_DIM, 1024),
  batchSize: toInt(process.env.INDEX_BATCH_SIZE, 50),
};

const args = process.argv.slice(2);
const getArg = (name: string) => {
  const idx = args.findIndex((arg) => arg === name);
  return idx >= 0 ? args[idx + 1] : undefined;
};

const limitArg = getArg("--limit");
const limit = limitArg ? Number.parseInt(limitArg, 10) : undefined;

const batchArg = getArg("--batch");
const batchSize = batchArg ? Number.parseInt(batchArg, 10) : config.batchSize;

const toVectorLiteral = (values: number[]) => `[${values.join(",")}]`;

const ensureDim = (vector: number[]) => {
  if (vector.length !== config.embeddingDim) {
    throw new Error(`Embedding size mismatch: expected ${config.embeddingDim}, got ${vector.length}`);
  }
};

const normalizeEmbedding = (value: unknown): number[] => {
  if (!Array.isArray(value)) {
    throw new Error("Embedding payload is not an array");
  }

  const first = value[0];
  const source =
    Array.isArray(first) && first.length > 0 && first.every((item) => typeof item === "number")
      ? first
      : value;

  const vector = source.map((item) => Number(item));
  if (vector.some((item) => Number.isNaN(item))) {
    throw new Error("Embedding payload has non-numeric values");
  }
  ensureDim(vector);
  return vector;
};

const embedText = async (input: string): Promise<number[]> => {
  const baseUrl = config.embeddingsApiUrl.replace(/\/$/, "");

  const teiResponse = await fetch(`${baseUrl}/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ inputs: input }),
  });

  if (teiResponse.ok) {
    return normalizeEmbedding(await teiResponse.json());
  }

  const compatResponse = await fetch(`${baseUrl}/v1/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input, model: "local" }),
  });

  if (!compatResponse.ok) {
    const body = await compatResponse.text();
    throw new Error(`Embeddings API error: ${compatResponse.status} ${body}`);
  }

  const payload = (await compatResponse.json()) as {
    data?: Array<{ embedding?: unknown }>;
  };
  return normalizeEmbedding(payload.data?.[0]?.embedding);
};

const normalizeErrorMessage = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, 1000);
};

async function main() {
  if (!Number.isFinite(batchSize) || batchSize <= 0) {
    throw new Error(`Invalid --batch value: ${batchArg}`);
  }

  const sql = postgres(config.databaseUrl, { max: 1 });
  let processed = 0;
  let indexed = 0;
  let failed = 0;

  while (!limit || processed < limit) {
    const take = limit ? Math.min(batchSize, Math.max(limit - processed, 0)) : batchSize;
    if (take === 0) {
      break;
    }

    const docs = await sql<DocumentRow[]>`
      SELECT id, path
      FROM documents
      WHERE embedding IS NULL
        AND indexing_status IN ('pending', 'error')
      ORDER BY id
      LIMIT ${take}
    `;

    if (docs.length === 0) {
      break;
    }

    for (const doc of docs) {
      await sql`
        UPDATE documents
        SET indexing_status = 'indexing',
            indexing_error = NULL
        WHERE id = ${doc.id}
      `;

      try {
        const embedding = await embedText(doc.path);
        const vectorLiteral = toVectorLiteral(embedding);

        await sql`
          UPDATE documents
          SET embedding = ${vectorLiteral}::vector,
              indexing_status = 'indexed',
              indexing_error = NULL,
              indexed_at = NOW()
          WHERE id = ${doc.id}
        `;
        indexed += 1;
      } catch (error) {
        await sql`
          UPDATE documents
          SET indexing_status = 'error',
              indexing_error = ${normalizeErrorMessage(error)}
          WHERE id = ${doc.id}
        `;
        failed += 1;
      }

      processed += 1;
      if (processed % 50 === 0) {
        console.log(`Processed ${processed} records (indexed: ${indexed}, failed: ${failed})...`);
      }
    }
  }

  await sql.end();
  console.log(`Vector indexing finished. Processed: ${processed}, indexed: ${indexed}, failed: ${failed}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
