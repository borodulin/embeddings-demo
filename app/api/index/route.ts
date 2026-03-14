import { NextResponse } from "next/server";
import { z } from "zod";

import { indexDocuments } from "@/lib/services/index-documents";

export const runtime = "nodejs";

const documentSchema = z.object({
  path: z.string().trim().min(1),
  chunkIndex: z.number().int().min(0),
  title: z.string().trim().min(1),
});

const requestSchema = z.object({
  documents: z.array(documentSchema).min(1).max(200),
});

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { documents } = parsed.data;

  try {
    const result = await indexDocuments(documents);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Index failed" },
      { status: 500 },
    );
  }
}
