import { db } from "@ledgr/db";
import { sql } from "drizzle-orm";

export function withTenantSql<T>(
  tenantId: string,
  fn: (tx: any) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`,
    );
    return await fn(tx);
  }) as Promise<T>;
}
