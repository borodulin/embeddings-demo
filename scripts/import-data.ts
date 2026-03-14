import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

import { parse } from "csv-parse";
import postgres from "postgres";

type ImportItem = {
  path: string;
  chunkIndex: number;
  title: string;
  content: string;
};

const config = {
  databaseUrl: process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/embeddings_demo",
};

const args = process.argv.slice(2);
const getArg = (name: string) => {
  const idx = args.findIndex((arg) => arg === name);
  return idx >= 0 ? args[idx + 1] : undefined;
};

const requestedDir = getArg("--dir") ?? "./import";
const limitArg = getArg("--limit");
const limit = limitArg ? Number.parseInt(limitArg, 10) : undefined;

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

const findBestPathField = (row: Record<string, string>, fallback: string): string => {
  const candidates = ["path", "full_path", "category_path"];
  for (const key of candidates) {
    const value = row[key];
    if (value && value.trim().length > 0) {
      return value.trim().slice(0, 2000);
    }
  }
  return fallback;
};

async function* importItemsFromFile(filePath: string): AsyncGenerator<ImportItem> {
  const fileName = path.basename(filePath);
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
        path: `${fileName}#${i}`,
        chunkIndex: i,
        title: `${fileName} #${i}`,
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
      yield {
        path: String(record.path ?? record.full_path ?? record.category_path ?? `${fileName}#${idx}`).slice(0, 2000),
        chunkIndex: idx,
        title: String(record.title ?? `${fileName} #${idx}`).slice(0, 200),
        content,
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
      const pathValue = findBestPathField(row, `${fileName}#${idx}`);
      yield {
        path: pathValue,
        chunkIndex: idx,
        title: findBestTitleField(row, `${fileName} #${idx}`),
        content: content.slice(0, 5000),
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
    .sort((a, b) => a.localeCompare(b));

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

      await sql`
        INSERT INTO documents (path, chunk_index, title, content, indexing_status, indexing_error, indexed_at)
        VALUES (${item.path}, ${item.chunkIndex}, ${item.title}, ${item.content}, 'pending', NULL, NULL)
        ON CONFLICT (path)
        DO UPDATE SET
          chunk_index = EXCLUDED.chunk_index,
          title = EXCLUDED.title,
          content = EXCLUDED.content,
          embedding = NULL,
          indexing_status = 'pending',
          indexing_error = NULL,
          indexed_at = NULL
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
