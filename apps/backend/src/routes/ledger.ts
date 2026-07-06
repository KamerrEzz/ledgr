import type { FastifyPluginAsync } from "fastify";
import { withTenantSql } from "../lib/tenant-sql.js";
import { validateLedgerIntegrity } from "../services/ledger-integrity.js";

const ledgerRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/", async (request) => {
    const tenantId = (request as any).tenantId as string;
    const { page = 1, limit = 50 } = request.query as {
      page?: number;
      limit?: number;
    };

    return withTenantSql(tenantId, async (tx) => {
      const offset = (page - 1) * limit;

      const [countRow] = await tx`SELECT COUNT(*)::int as count FROM ledger_entries`;
      const total = countRow.count;

      const entries = await tx`
        SELECT id, tenant_id, order_id, entry_type, amount_cents, currency, description, metadata, created_at
        FROM ledger_entries
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;

      return { entries, total, page, limit };
    });
  });

  fastify.get("/entries/:orderId", async (request, reply) => {
    const tenantId = (request as any).tenantId as string;
    const { orderId } = request.params as { orderId: string };

    return withTenantSql(tenantId, async (tx) => {
      const entries = await tx`
        SELECT id, tenant_id, order_id, entry_type, amount_cents, currency, description, metadata, created_at
        FROM ledger_entries
        WHERE order_id = ${orderId}
        ORDER BY created_at DESC
      `;

      if (entries.length === 0) {
        reply.code(404);
        return { error: "No ledger entries found for this order" };
      }

      return entries;
    });
  });

  fastify.get("/summary", async (request) => {
    const tenantId = (request as any).tenantId as string;

    return withTenantSql(tenantId, async (tx) => {
      const [summary] = await tx`
        SELECT
          COUNT(*) FILTER (WHERE entry_type = 'credit')::int as credit_count,
          COALESCE(SUM(CASE WHEN entry_type = 'credit' THEN amount_cents ELSE 0 END), 0) as credit_total,
          COUNT(*) FILTER (WHERE entry_type = 'debit')::int as debit_count,
          COALESCE(SUM(CASE WHEN entry_type = 'debit' THEN amount_cents ELSE 0 END), 0) as debit_total
        FROM ledger_entries
      `;

      const creditTotal = BigInt(summary.credit_total);
      const debitTotal = BigInt(summary.debit_total);

      return {
        credits: { count: summary.credit_count, total_cents: String(creditTotal) },
        debits: { count: summary.debit_count, total_cents: String(debitTotal) },
        net: String(creditTotal - debitTotal),
      };
    });
  });

  fastify.get("/integrity", async (request) => {
    const tenantId = (request as any).tenantId as string;
    return validateLedgerIntegrity(tenantId);
  });
};

export default ledgerRoutes;
