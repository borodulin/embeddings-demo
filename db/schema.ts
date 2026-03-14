import { bigserial, customType, integer, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";

import { EMBEDDING_DIM } from "../lib/constants";

const vector = customType<{
  data: number[];
  driverData: string;
  config: { dimensions: number };
}>({
  dataType(config) {
    return `vector(${config?.dimensions ?? EMBEDDING_DIM})`;
  },
  toDriver(value) {
    return `[${value.join(",")}]`;
  },
});

export const documents = pgTable(
  "documents",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    path: text("path").notNull(),
    chunkIndex: integer("chunk_index").notNull(),
    title: text("title").notNull(),
    embedding: vector("embedding", { dimensions: EMBEDDING_DIM }),
    indexingStatus: text("indexing_status").notNull().default("pending"),
    indexingError: text("indexing_error"),
    indexedAt: timestamp("indexed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("documents_path_unique").on(table.path)],
);
