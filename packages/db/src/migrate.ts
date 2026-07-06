import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const MIGRATIONS_DIR = path.resolve(__dirname, "..", "migrations");

export async function runMigrations(databaseUrl?: string) {
  const sql = postgres(databaseUrl ?? process.env.DATABASE_URL ?? "postgres://ledgr:ledgr_dev@localhost:5432/ledgr");

  await sql`CREATE TABLE IF NOT EXISTS _migrations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;

  const applied = await sql`SELECT name FROM _migrations ORDER BY id`;
  const appliedNames = new Set(applied.map((r) => r.name));

  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    if (appliedNames.has(file)) {
      continue;
    }

    const filePath = path.join(MIGRATIONS_DIR, file);
    const content = fs.readFileSync(filePath, "utf-8");

    await sql.begin(async (tx) => {
      await tx.unsafe(content);
      await tx`INSERT INTO _migrations (name) VALUES (${file})`;
    });

    console.log(`Applied migration: ${file}`);
  }

  await sql.end();
}
