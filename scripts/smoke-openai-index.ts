import "./_shared/env";

import { config } from "../lib/config";
import { sql as appDb } from "../lib/db";
import { closeOpenAiProxyAgents } from "../lib/embeddings/providers/openai";
import { indexDocumentByModel } from "../lib/services/index-documents";
import { createScriptDb } from "./_shared/db";

type SmokeRow = {
  indexing_status: "pending" | "indexing" | "indexed" | "error";
  indexing_error: string | null;
  has_embedding: boolean;
};

const ensureOpenAiConfig = () => {
  if (config.openAiProxyUrl) {
    return;
  }

  if (!config.openAiApiKey) {
    throw new Error(
      "OpenAI smoke test requires OPENAI_API_KEY (or OPENAI_PROXY_URL for proxy mode).",
    );
  }
};

const createPendingSmokeDocument = async (db: ReturnType<typeof createScriptDb>): Promise<number> => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const smokePath = `smoke/openai-index/${suffix}`;
  const smokeTitle = `OpenAI smoke ${suffix}`;

  const documentRows = await db<{ id: number }[]>`
    INSERT INTO documents (path, chunk_index, title)
    VALUES (${smokePath}, ${0}, ${smokeTitle})
    ON CONFLICT (path)
    DO UPDATE SET
      chunk_index = EXCLUDED.chunk_index,
      title = EXCLUDED.title
    RETURNING id
  `;

  const documentId = documentRows[0].id;

  await db`
    INSERT INTO document_vectors_text_embedding_3_small
      (document_id, embedding, indexing_status, indexing_error, indexed_at)
    VALUES (${documentId}, NULL, 'pending', NULL, NULL)
    ON CONFLICT (document_id)
    DO UPDATE SET
      embedding = NULL,
      indexing_status = 'pending',
      indexing_error = NULL,
      indexed_at = NULL
  `;

  return documentId;
};

const loadSmokeRow = async (
  db: ReturnType<typeof createScriptDb>,
  documentId: number,
): Promise<SmokeRow | null> => {
  const rows = await db<SmokeRow[]>`
    SELECT
      indexing_status,
      indexing_error,
      embedding IS NOT NULL AS has_embedding
    FROM document_vectors_text_embedding_3_small
    WHERE document_id = ${documentId}
    LIMIT 1
  `;
  return rows[0] ?? null;
};

async function main() {
  ensureOpenAiConfig();
  const scriptDb = createScriptDb();

  try {
    const documentId = await createPendingSmokeDocument(scriptDb);
    const result = await indexDocumentByModel(documentId, `smoke/openai-index/doc/${documentId}`, "text_embedding_3_small");

    const smokeRow = await loadSmokeRow(scriptDb, documentId);
    if (!smokeRow) {
      throw new Error(`Smoke document vector row not found for document_id=${documentId}`);
    }

    if (result !== "indexed" || smokeRow.indexing_status !== "indexed" || !smokeRow.has_embedding) {
      const details = JSON.stringify(
        {
          result,
          vectorRow: smokeRow,
        },
        null,
        2,
      );
      throw new Error(`OpenAI indexing smoke test failed.\n${details}`);
    }

    console.log(
      `OpenAI indexing smoke test passed (document_id=${documentId}).`,
    );
  } finally {
    await closeOpenAiProxyAgents();
    await scriptDb.end();
    await appDb.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
