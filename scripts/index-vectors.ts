import { embedText } from "../lib/embeddings";
import { toVectorLiteral } from "../lib/vector";
import { getArg, parseOptionalIntArg, toInt } from "./_shared/cli";
import { createScriptDb } from "./_shared/db";

type DocumentRow = {
  id: number;
  path: string;
};

const scriptConfig = {
  batchSize: toInt(process.env.INDEX_BATCH_SIZE, 50),
};

const args = process.argv.slice(2);

const limitArg = getArg(args, "--limit");
const limit = parseOptionalIntArg(limitArg);

const batchArg = getArg(args, "--batch");
const batchSize = parseOptionalIntArg(batchArg) ?? scriptConfig.batchSize;

const normalizeErrorMessage = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, 1000);
};

async function main() {
  if (!Number.isFinite(batchSize) || batchSize <= 0) {
    throw new Error(`Invalid --batch value: ${batchArg}`);
  }

  const sql = createScriptDb();
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
