import {
  bigserial,
  bigint,
  customType,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

import { MODEL_DIMENSION_BY_NAME } from "../lib/models";

const vector = customType<{
  data: number[];
  driverData: string;
  config: { dimensions: number };
}>({
  dataType(config) {
    return `vector(${config?.dimensions ?? MODEL_DIMENSION_BY_NAME.qwen3_embedding_0_6b})`;
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
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("documents_path_unique").on(table.path)],
);

export const documentVectorsQwen3Embedding060b = pgTable(
  "document_vectors_qwen3_embedding_0_6b",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    documentId: bigint("document_id", { mode: "number" })
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    embedding: vector("embedding", { dimensions: MODEL_DIMENSION_BY_NAME.qwen3_embedding_0_6b }),
    indexingStatus: text("indexing_status").notNull().default("pending"),
    indexingError: text("indexing_error"),
    indexedAt: timestamp("indexed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("document_vectors_qwen3_embedding_0_6b_document_unique").on(table.documentId),
    index("document_vectors_qwen3_embedding_0_6b_indexing_status_idx").on(table.indexingStatus),
  ],
);

export const documentVectorsGigachat = pgTable(
  "document_vectors_gigachat",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    documentId: bigint("document_id", { mode: "number" })
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    embedding: vector("embedding", { dimensions: MODEL_DIMENSION_BY_NAME.gigachat }),
    indexingStatus: text("indexing_status").notNull().default("pending"),
    indexingError: text("indexing_error"),
    indexedAt: timestamp("indexed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("document_vectors_gigachat_document_unique").on(table.documentId),
    index("document_vectors_gigachat_indexing_status_idx").on(table.indexingStatus),
  ],
);

export const documentVectorsTextEmbedding3Small = pgTable(
  "document_vectors_text_embedding_3_small",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    documentId: bigint("document_id", { mode: "number" })
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    embedding: vector("embedding", { dimensions: MODEL_DIMENSION_BY_NAME.text_embedding_3_small }),
    indexingStatus: text("indexing_status").notNull().default("pending"),
    indexingError: text("indexing_error"),
    indexedAt: timestamp("indexed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("document_vectors_text_embedding_3_small_document_unique").on(table.documentId),
    index("document_vectors_text_embedding_3_small_indexing_status_idx").on(table.indexingStatus),
  ],
);
