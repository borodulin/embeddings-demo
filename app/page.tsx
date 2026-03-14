"use client";

import { FormEvent, useMemo, useState } from "react";

import styles from "./page.module.css";

type ModelKey = "qwen3_embedding_0_6b" | "gigachat" | "text_embedding_3_small";

const MODEL_LABELS: Record<ModelKey, string> = {
  qwen3_embedding_0_6b: "Qwen3-Embedding-0.6B",
  gigachat: "GigaChat",
  text_embedding_3_small: "text-embedding-3-small",
};

const MODEL_ORDER: ModelKey[] = ["qwen3_embedding_0_6b", "gigachat", "text_embedding_3_small"];

type SearchItem = {
  id: number;
  path: string;
  title: string;
  snippet: string;
  score: number;
};

type ResultsByModel = Record<ModelKey, SearchItem[]>;
type ErrorsByModel = Record<ModelKey, string | null>;
type SearchMethodKey = "full_text" | ModelKey;

const emptyResultsByModel = (): ResultsByModel => ({
  qwen3_embedding_0_6b: [],
  gigachat: [],
  text_embedding_3_small: [],
});

const emptyErrorsByModel = (): ErrorsByModel => ({
  qwen3_embedding_0_6b: null,
  gigachat: null,
  text_embedding_3_small: null,
});

export default function Home() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fullTextResults, setFullTextResults] = useState<SearchItem[]>([]);
  const [resultsByModel, setResultsByModel] = useState<ResultsByModel>(emptyResultsByModel);
  const [errorsByModel, setErrorsByModel] = useState<ErrorsByModel>(emptyErrorsByModel);

  const showEmpty = useMemo(
    () =>
      !loading &&
      !error &&
      fullTextResults.length === 0 &&
      MODEL_ORDER.every(
        (model) => resultsByModel[model].length === 0 && (errorsByModel[model] === null || errorsByModel[model] === ""),
      ),
    [error, errorsByModel, fullTextResults.length, loading, resultsByModel],
  );

  const methodOrder: SearchMethodKey[] = useMemo(
    () => ["full_text", ...MODEL_ORDER],
    [],
  );

  const getMethodLabel = (method: SearchMethodKey): string => {
    if (method === "full_text") {
      return "Full-text (PostgreSQL)";
    }

    return MODEL_LABELS[method];
  };

  const getMethodResults = (method: SearchMethodKey): SearchItem[] => {
    if (method === "full_text") {
      return fullTextResults;
    }

    return resultsByModel[method];
  };

  const getMethodError = (method: SearchMethodKey): string | null =>
    method === "full_text" ? null : errorsByModel[method];

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = query.trim();
    if (!text) {
      return;
    }

    setLoading(true);
    setError(null);
    setFullTextResults([]);
    setErrorsByModel(emptyErrorsByModel());

    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: text, limit: 10 }),
      });

      const payload = (await response.json()) as {
        error?: string;
        fullTextResults?: SearchItem[];
        resultsByModel?: Partial<ResultsByModel>;
        errorsByModel?: Partial<ErrorsByModel>;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Search request failed");
      }

      setFullTextResults(payload.fullTextResults ?? []);
      setResultsByModel({
        qwen3_embedding_0_6b: payload.resultsByModel?.qwen3_embedding_0_6b ?? [],
        gigachat: payload.resultsByModel?.gigachat ?? [],
        text_embedding_3_small: payload.resultsByModel?.text_embedding_3_small ?? [],
      });
      setErrorsByModel({
        qwen3_embedding_0_6b: payload.errorsByModel?.qwen3_embedding_0_6b ?? null,
        gigachat: payload.errorsByModel?.gigachat ?? null,
        text_embedding_3_small: payload.errorsByModel?.text_embedding_3_small ?? null,
      });
    } catch (requestError) {
      setFullTextResults([]);
      setResultsByModel(emptyResultsByModel());
      setErrorsByModel(emptyErrorsByModel());
      setError(requestError instanceof Error ? requestError.message : "Search request failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <h1 className={styles.logo}>VectorSearch</h1>

        <form onSubmit={onSubmit} className={styles.form}>
          <input
            className={styles.searchInput}
            placeholder="Найти по смыслу..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search query"
          />
          <button className={styles.searchButton} disabled={loading} type="submit">
            {loading ? "Ищу..." : "Поиск"}
          </button>
        </form>

        {error ? <p className={styles.error}>{error}</p> : null}
        {showEmpty ? <p className={styles.hint}>Введите запрос и нажмите поиск</p> : null}

        <section className={styles.results}>
          {methodOrder.map((method) => {
            const methodError = getMethodError(method);
            const methodResults = getMethodResults(method);

            return (
            <section key={method} className={styles.modelColumn}>
              <h2 className={styles.modelTitle}>{getMethodLabel(method)}</h2>
              {methodError ? <p className={styles.error}>{methodError}</p> : null}
              {!methodError && methodResults.length === 0 ? (
                <p className={styles.hint}>Нет результатов</p>
              ) : null}
              {methodResults.map((item) => (
                <article key={`${method}-${item.id}`} className={styles.resultCard}>
                  <p className={styles.resultUrl}>{item.path}</p>
                  <h3 className={styles.resultTitle}>{item.title}</h3>
                  <p className={styles.resultSnippet}>{item.snippet}</p>
                  <p className={styles.resultScore}>score: {item.score.toFixed(4)}</p>
                </article>
              ))}
            </section>
            );
          })}
        </section>
      </main>
    </div>
  );
}
