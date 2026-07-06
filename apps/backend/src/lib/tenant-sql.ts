import { sql } from "@ledgr/db";

export function withTenantSql<T>(
  tenantId: string,
  fn: (tx: any) => Promise<T>,
): Promise<T> {
  return sql.begin(async (tx) => {
    await tx`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
    return await fn(tx) as any;
  }) as Promise<T>;
}
