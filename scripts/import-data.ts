import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

import { parse } from "csv-parse";
import postgres from "postgres";

type ImportItem = {
  source: string;
  chunkIndex: number;
  title: string;
  content: string;
  embedding?: number[];
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
};

const args = process.argv.slice(2);
const getArg = (name: string) => {
  const idx = args.findIndex((arg) => arg === name);
  return idx >= 0 ? args[idx + 1] : undefined;
};

const requestedDir = getArg("--dir") ?? "./import";
const limitArg = getArg("--limit");
const limit = limitArg ? Number.parseInt(limitArg, 10) : undefined;

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
  const vector = value.map((item) => Number(item));
  if (vector.some((item) => Number.isNaN(item))) {
    throw new Error("Embedding payload has non-numeric values");
  }
  ensureDim(vector);
  return vector;
};

const tryParseEmbedding = (value: unknown): number[] | undefined => {
  if (typeof value !== "string" || value.trim().length === 0) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    const vector = normalizeEmbedding(parsed);
    return vector;
  } catch {
    return undefined;
  }
};

const chunkText = (text: string, chunkSize = 1000, overlap = 200): string[] => {
  if (text.length <= chunkSize) {
    return [text];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    if (end === text.length) {
      break;
    }
    start = Math.max(end - overlap, start + 1);
  }

  return chunks;
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

const findBestContentField = (row: Record<string, string>): string | undefined => {
  const candidates = ["content", "text", "description", "name", "title", "category_name"];
  for (const key of candidates) {
    const value = row[key];
    if (value && value.trim().length > 0) {
      return value;
    }
  }
  return undefined;
};

const findBestTitleField = (row: Record<string, string>, fallback: string): string => {
  const candidates = ["title", "name", "category_name", "id"];
  for (const key of candidates) {
    const value = row[key];
    if (value && value.trim().length > 0) {
      return value.trim().slice(0, 200);
    }
  }
  return fallback;
};

async function* importItemsFromFile(filePath: string): AsyncGenerator<ImportItem> {
  const source = path.basename(filePath);
  const ext = path.extname(filePath).toLowerCase();

  if (ext === ".txt" || ext === ".md") {
    const content = await fsp.readFile(filePath, "utf8");
    const chunks = chunkText(content);
    for (let i = 0; i < chunks.length; i += 1) {
      const chunk = chunks[i];
      if (chunk.trim().length === 0) {
        continue;
      }
      yield {
        source,
        chunkIndex: i,
        title: `${source} #${i}`,
        content: chunk.trim(),
      };
    }
    return;
  }

  if (ext === ".json") {
    const raw = await fsp.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    const rows = Array.isArray(parsed) ? parsed : [parsed];
    let idx = 0;
    for (const row of rows) {
      if (!row || typeof row !== "object") {
        continue;
      }
      const record = row as Record<string, unknown>;
      const content = String(record.content ?? record.text ?? "").trim();
      if (!content) {
        continue;
      }
      const embedding = tryParseEmbedding(record.embedding);
      yield {
        source,
        chunkIndex: idx,
        title: String(record.title ?? `${source} #${idx}`).slice(0, 200),
        content,
        embedding,
      };
      idx += 1;
    }
    return;
  }

  if (ext === ".csv") {
    const parser = fs
      .createReadStream(filePath)
      .pipe(parse({ columns: true, bom: true, skip_empty_lines: true, relax_quotes: true }));

    let idx = 0;
    for await (const row of parser as AsyncIterable<Record<string, string>>) {
      const content = findBestContentField(row)?.trim();
      if (!content) {
        continue;
      }
      const embedding = tryParseEmbedding(row.embedding ?? row.vector ?? row.embeddings);
      yield {
        source,
        chunkIndex: idx,
        title: findBestTitleField(row, `${source} #${idx}`),
        content: content.slice(0, 5000),
        embedding,
      };
      idx += 1;
    }
  }
}

const resolveImportDir = async (value: string): Promise<string> => {
  const direct = path.resolve(process.cwd(), value);
  if (fs.existsSync(direct)) {
    return direct;
  }

  if (value === "./import" || value === "import") {
    const sibling = path.resolve(process.cwd(), "../import");
    if (fs.existsSync(sibling)) {
      return sibling;
    }
  }

  throw new Error(`Import directory does not exist: ${direct}`);
};

async function main() {
  const dirPath = await resolveImportDir(requestedDir);
  const sql = postgres(config.databaseUrl, { max: 1 });

  const files = (await fsp.readdir(dirPath))
    .map((name) => path.join(dirPath, name))
    .filter((fullPath) => fs.statSync(fullPath).isFile())
    .sort((a, b) => {
      const aHasEmb = /embedding/i.test(path.basename(a));
      const bHasEmb = /embedding/i.test(path.basename(b));
      if (aHasEmb !== bHasEmb) {
        return aHasEmb ? -1 : 1;
      }
      return a.localeCompare(b);
    });

  if (files.length === 0) {
    console.log(`No files found in ${dirPath}`);
    await sql.end();
    return;
  }

  let imported = 0;
  for (const file of files) {
    for await (const item of importItemsFromFile(file)) {
      if (limit && imported >= limit) {
        console.log(`Reached limit ${limit}.`);
        await sql.end();
        return;
      }

      const embedding = item.embedding ?? (await embedText(item.content));
      ensureDim(embedding);
      const vectorLiteral = toVectorLiteral(embedding);

      await sql`
        INSERT INTO documents (source, chunk_index, title, content, embedding)
        VALUES (${item.source}, ${item.chunkIndex}, ${item.title}, ${item.content}, ${vectorLiteral}::vector)
        ON CONFLICT (source, chunk_index)
        DO UPDATE SET
          title = EXCLUDED.title,
          content = EXCLUDED.content,
          embedding = EXCLUDED.embedding
      `;

      imported += 1;
      if (imported % 50 === 0) {
        console.log(`Imported ${imported} records...`);
      }
    }
  }

  await sql.end();
  console.log(`Import finished. Total records: ${imported}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
