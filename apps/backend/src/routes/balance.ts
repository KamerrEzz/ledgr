import type { FastifyPluginAsync } from "fastify";
import { withTenantSql } from "../lib/tenant-sql.js";

const balanceRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/", async (request) => {
    const tenantId = (request as any).tenantId as string;

    return withTenantSql(tenantId, async (tx) => {
      const [balance] = await tx`
        SELECT
          COALESCE(SUM(CASE WHEN entry_type = 'credit' THEN amount_cents ELSE 0 END), 0) as total_credits,
          COALESCE(SUM(CASE WHEN entry_type = 'debit' THEN amount_cents ELSE 0 END), 0) as total_debits,
          COALESCE(SUM(CASE WHEN entry_type = 'credit' THEN amount_cents ELSE -amount_cents END), 0) as net_balance
        FROM ledger_entries
        WHERE tenant_id = ${tenantId}
      `;

      return {
        total_credits: String(balance.total_credits),
        total_debits: String(balance.total_debits),
        net_balance: String(balance.net_balance),
        currency: "USD",
      };
    });
  });

  fastify.get("/history", async (request) => {
    const tenantId = (request as any).tenantId as string;

    return withTenantSql(tenantId, async (tx) => {
      const history = await tx`
        SELECT
          date_trunc('day', created_at) as day,
          SUM(CASE WHEN entry_type = 'credit' THEN amount_cents ELSE 0 END) as credits,
          SUM(CASE WHEN entry_type = 'debit' THEN amount_cents ELSE 0 END) as debits
        FROM ledger_entries
        WHERE tenant_id = ${tenantId} AND created_at > now() - interval '30 days'
        GROUP BY date_trunc('day', created_at)
        ORDER BY day DESC
      `;

      return {
        history: history.map((row: Record<string, unknown>) => ({
          day: row.day as string,
          credits: String(row.credits),
          debits: String(row.debits),
        })),
      };
    });
  });
};

export default balanceRoutes;
