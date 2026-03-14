import { NextResponse } from "next/server";
import { z } from "zod";

import { sql } from "@/lib/db";
import { embedText } from "@/lib/embeddings";
import { toVectorLiteral } from "@/lib/vector";

export const runtime = "nodejs";

const documentSchema = z.object({
  path: z.string().trim().min(1).optional(),
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
      const path = doc.path ?? `${doc.title}-${doc.chunkIndex}`;
      const embedding = await embedText(path);
      const vectorLiteral = toVectorLiteral(embedding);

      await sql`
        INSERT INTO documents (path, chunk_index, title, content, embedding, indexing_status, indexing_error, indexed_at)
        VALUES (
          ${path},
          ${doc.chunkIndex},
          ${doc.title},
          ${doc.content},
          ${vectorLiteral}::vector,
          'indexed',
          NULL,
          NOW()
        )
        ON CONFLICT (path)
        DO UPDATE SET
          chunk_index = EXCLUDED.chunk_index,
          title = EXCLUDED.title,
          content = EXCLUDED.content,
          embedding = EXCLUDED.embedding,
          indexing_status = 'indexed',
          indexing_error = NULL,
          indexed_at = NOW()
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
