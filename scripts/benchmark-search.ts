import "./_shared/env";

import { closeOpenAiProxyAgents } from "../lib/embeddings/providers/openai";
import { embedText } from "../lib/embeddings";
import { sql as appDb } from "../lib/db";
import { EMBEDDING_MODELS, type EmbeddingModel } from "../lib/models";
import { searchDocumentsByModel } from "../lib/repositories/document-vectors";
import { searchDocumentsFullText, type SearchRow } from "../lib/repositories/documents";
import { toVectorLiteral } from "../lib/vector";
import { getArg, parseOptionalIntArg } from "./_shared/cli";

type MethodResult = {
  method: string;
  latencyMs: number;
  rows: SearchRow[];
  error?: string;
};

type BenchmarkQueryGroup = {
  title: string;
  queries: string[];
};

const args = process.argv.slice(2);
const topK = parseOptionalIntArg(getArg(args, "--limit")) ?? 5;

const QUERY_GROUPS: BenchmarkQueryGroup[] = [
  {
    title: "Синонимы и разговорная лексика",
    queries: ["лекарства", "ноутбук", "велик", "косметичка"],
  },
  {
    title: "Ситуационные запросы (intent)",
    queries: [
      "у меня протекает кран",
      "собираюсь в поход",
      "переезд в новую квартиру",
      "первый раз завожу кота",
      "хочу научиться рисовать",
    ],
  },
  {
    title: "Подарки и события",
    queries: ["подарок маме на 8 марта", "что купить первокласснику", "новогодние украшения"],
  },
  {
    title: "Кросс-языковые запросы",
    queries: ["gaming mouse", "DIY tools", "smartphone accessories"],
  },
  {
    title: "Абстрактные формулировки",
    queries: ["здоровое питание", "уютный вечер дома", "детский день рождения"],
  },
];

const MODEL_LABELS: Record<EmbeddingModel, string> = {
  qwen3_embedding_0_6b: "Qwen3-Embedding-0.6B",
  gigachat: "GigaChat",
  text_embedding_3_small: "text-embedding-3-small",
};

const clip = (value: string, max = 88): string => {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) {
    return normalized;
  }

  return `${normalized.slice(0, max - 1)}…`;
};

const formatRows = (rows: SearchRow[]): string => {
  if (rows.length === 0) {
    return "—";
  }

  return rows
    .map(
      (row, idx) =>
        `${idx + 1}. ${clip(row.path)} (_${row.score.toFixed(4)}_)`,
    )
    .join("<br>");
};

const withLatency = async <T>(fn: () => Promise<T>): Promise<{ value: T; latencyMs: number }> => {
  const startedAt = performance.now();
  const value = await fn();
  return { value, latencyMs: performance.now() - startedAt };
};

const runFullText = async (query: string, limit: number): Promise<MethodResult> => {
  try {
    const measured = await withLatency(() => searchDocumentsFullText(query, limit));
    return {
      method: "Full-text (PostgreSQL)",
      latencyMs: measured.latencyMs,
      rows: measured.value,
    };
  } catch (error) {
    return {
      method: "Full-text (PostgreSQL)",
      latencyMs: 0,
      rows: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

const runSemanticModel = async (query: string, model: EmbeddingModel, limit: number): Promise<MethodResult> => {
  try {
    const measured = await withLatency(async () => {
      const embedding = await embedText(query, model);
      const vectorLiteral = toVectorLiteral(embedding);
      return searchDocumentsByModel(model, vectorLiteral, limit);
    });

    return {
      method: MODEL_LABELS[model],
      latencyMs: measured.latencyMs,
      rows: measured.value.map((row) => ({
        ...row,
        score: Number(row.score),
      })),
    };
  } catch (error) {
    return {
      method: MODEL_LABELS[model],
      latencyMs: 0,
      rows: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

const renderMethodTable = (results: MethodResult[]): string => {
  const header = [
    "| Метод | Латентность (мс) | Top results |",
    "| --- | ---: | --- |",
  ];
  const body = results.map((result) => {
    const latency = result.error ? "error" : result.latencyMs.toFixed(1);
    const top = result.error ? `ERROR: ${clip(result.error, 140)}` : formatRows(result.rows);
    return `| ${result.method} | ${latency} | ${top} |`;
  });

  return [...header, ...body].join("\n");
};

async function main() {
  if (!Number.isFinite(topK) || topK < 1 || topK > 50) {
    throw new Error(`Invalid --limit value: ${topK}. Expected 1..50.`);
  }

  console.log("# Search benchmark report");
  console.log("");
  console.log(`Top K: ${topK}`);
  console.log(`Generated at: ${new Date().toISOString()}`);
  console.log("");

  for (const group of QUERY_GROUPS) {
    console.log(`## ${group.title}`);
    console.log("");

    for (const query of group.queries) {
      const fullTextPromise = runFullText(query, topK);
      const semanticPromises = EMBEDDING_MODELS.map((model) => runSemanticModel(query, model, topK));
      const [fullTextResult, ...semanticResults] = await Promise.all([fullTextPromise, ...semanticPromises]);

      console.log(`### Запрос: "${query}"`);
      console.log("");
      console.log(renderMethodTable([fullTextResult, ...semanticResults]));
      console.log("");
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeOpenAiProxyAgents();
    await appDb.end();
  });
