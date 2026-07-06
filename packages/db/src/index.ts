import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

const connectionString =
  process.env.DATABASE_URL ??
  "postgres://app:ledgr_app@localhost:5432/ledgr";

const client = postgres(connectionString);

export const db = drizzle(client, { schema });

export { schema };
