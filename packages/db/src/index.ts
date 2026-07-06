import postgres from "postgres";

export const sql = postgres(process.env.DATABASE_URL ?? "postgres://ledgr:ledgr_dev@localhost:5432/ledgr");

export { postgres };

export { runMigrations } from "./migrate.js";
export { runSeeds } from "./seed.js";
