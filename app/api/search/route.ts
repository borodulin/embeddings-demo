import { NextResponse } from "next/server";
import { z } from "zod";

import { searchDocuments } from "@/lib/services/search-documents";

export const runtime = "nodejs";

const requestSchema = z.object({
  query: z.string().trim().min(1),
  limit: z.number().int().min(1).max(50).optional(),
});

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
    const result = await searchDocuments(query, limit);
    return NextResponse.json({
      ...result,
      count: result.results.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Search failed" },
      { status: 500 },
    );
  }
}
