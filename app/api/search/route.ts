import { NextResponse } from "next/server";
import { z } from "zod";

import { sql } from "@/lib/db";
import { embedText } from "@/lib/embeddings";
import { toVectorLiteral } from "@/lib/vector";

export const runtime = "nodejs";

const requestSchema = z.object({
  query: z.string().trim().min(1),
  limit: z.number().int().min(1).max(50).optional(),
});

type SearchRow = {
  id: number;
  path: string;
  title: string;
  snippet: string;
  score: number;
};

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { query, limit = 10 } = parsed.data;

  try {
    const queryEmbedding = await embedText(query);
    const vectorLiteral = toVectorLiteral(queryEmbedding);

    const rows = await sql<SearchRow[]>`
      SELECT
        id,
        path,
        title,
        LEFT(content, 220) AS snippet,
        1 - (embedding <=> ${vectorLiteral}::vector) AS score
      FROM documents
      WHERE embedding IS NOT NULL
        AND indexing_status = 'indexed'
      ORDER BY embedding <=> ${vectorLiteral}::vector
      LIMIT ${limit}
    `;

    return NextResponse.json({
      query,
      count: rows.length,
      results: rows.map((row) => ({
        id: row.id,
        path: row.path,
        title: row.title,
        snippet: row.snippet,
        score: Number(row.score),
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Search failed" },
      { status: 500 },
    );
  }
}
