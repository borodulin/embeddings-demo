import { NextResponse } from "next/server";
import { z } from "zod";

import { sql } from "@/lib/db";
import { embedText } from "@/lib/embeddings";
import { toVectorLiteral } from "@/lib/vector";

export const runtime = "nodejs";

const documentSchema = z.object({
  source: z.string().trim().min(1),
  chunkIndex: z.number().int().min(0),
  title: z.string().trim().min(1),
  content: z.string().trim().min(1),
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
    let indexed = 0;

    for (const doc of documents) {
      const embedding = await embedText(doc.content);
      const vectorLiteral = toVectorLiteral(embedding);

      await sql`
        INSERT INTO documents (source, chunk_index, title, content, embedding)
        VALUES (${doc.source}, ${doc.chunkIndex}, ${doc.title}, ${doc.content}, ${vectorLiteral}::vector)
        ON CONFLICT (source, chunk_index)
        DO UPDATE SET
          title = EXCLUDED.title,
          content = EXCLUDED.content,
          embedding = EXCLUDED.embedding
      `;
      indexed += 1;
    }

    return NextResponse.json({ indexed });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Index failed" },
      { status: 500 },
    );
  }
}
