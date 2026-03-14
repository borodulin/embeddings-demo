import fs from "node:fs/promises";
import path from "node:path";

import postgres from "postgres";

const databaseUrl =
  process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/embeddings_demo";

const client = postgres(databaseUrl, {
  max: 1,
});

async function main() {
  const migrationsDir = path.resolve(process.cwd(), "drizzle");
  const migrationFiles = (await fs.readdir(migrationsDir))
    .filter((file) => file.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b));

  await client`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id BIGSERIAL PRIMARY KEY,
      file_name TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  const appliedRows = await client<{ file_name: string }[]>`
    SELECT file_name FROM schema_migrations
  `;
  const applied = new Set(appliedRows.map((row) => row.file_name));

  for (const file of migrationFiles) {
    if (applied.has(file)) {
      continue;
    }

    const sqlContent = await fs.readFile(path.join(migrationsDir, file), "utf8");
    await client.begin(async (tx) => {
      await tx.unsafe(sqlContent);
      await tx`
        INSERT INTO schema_migrations (file_name)
        VALUES (${file})
      `;
    });

    console.log(`Applied migration: ${file}`);
  }

  console.log("Migrations are up to date.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end();
  });
