"use client";

import { FormEvent, useMemo, useState } from "react";

import styles from "./page.module.css";

type SearchItem = {
  id: number;
  path: string;
  title: string;
  snippet: string;
  score: number;
};

export default function Home() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<SearchItem[]>([]);

  const showEmpty = useMemo(() => !loading && !error && results.length === 0, [error, loading, results]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = query.trim();
    if (!text) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: text, limit: 10 }),
      });

      const payload = (await response.json()) as { error?: string; results?: SearchItem[] };
      if (!response.ok) {
        throw new Error(payload.error ?? "Search request failed");
      }

      setResults(payload.results ?? []);
    } catch (requestError) {
      setResults([]);
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
          {results.map((item) => (
            <article key={item.id} className={styles.resultCard}>
              <p className={styles.resultUrl}>{item.path}</p>
              <h2 className={styles.resultTitle}>{item.title}</h2>
              <p className={styles.resultSnippet}>{item.snippet}</p>
              <p className={styles.resultScore}>score: {item.score.toFixed(4)}</p>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}
