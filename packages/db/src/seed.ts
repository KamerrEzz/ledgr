import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SEEDS_DIR = path.resolve(__dirname, "..", "seeds");

export async function runSeeds(databaseUrl?: string) {
  const sql = postgres(databaseUrl ?? process.env.DATABASE_URL ?? "postgres://ledgr:ledgr_dev@localhost:5432/ledgr");

  const files = fs.readdirSync(SEEDS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const filePath = path.join(SEEDS_DIR, file);
    const content = fs.readFileSync(filePath, "utf-8");

    await sql.unsafe(content);

    console.log(`Applied seed: ${file}`);
  }

  await sql.end();
}
