import type { FastifyPluginAsync } from "fastify";
import { db, schema } from "@ledgr/db";
import { eq, count, desc, sql } from "drizzle-orm";
import { withTenantSql } from "../lib/tenant-sql.js";
import { validateLedgerIntegrity } from "../services/ledger-integrity.js";
import { validate } from "../lib/validate.js";
import { paginationSchema } from "../schemas/index.js";

const ledgerRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/", async (request, reply) => {
    const query = validate(paginationSchema, request.query, reply);
    if (!query) return;
    const tenantId = (request as any).tenantId as string;

    return withTenantSql(tenantId, async (tx) => {
      const offset = (query.page - 1) * query.limit;

      const [countRow] = await tx
        .select({ count: count() })
        .from(schema.ledgerEntries);
      const total = countRow?.count ?? 0;

      const entries = await tx
        .select({
          id: schema.ledgerEntries.id,
          tenantId: schema.ledgerEntries.tenantId,
          orderId: schema.ledgerEntries.orderId,
          entryType: schema.ledgerEntries.entryType,
          amountCents: schema.ledgerEntries.amountCents,
          currency: schema.ledgerEntries.currency,
          description: schema.ledgerEntries.description,
          metadata: schema.ledgerEntries.metadata,
          createdAt: schema.ledgerEntries.createdAt,
        })
        .from(schema.ledgerEntries)
        .orderBy(desc(schema.ledgerEntries.createdAt))
        .limit(query.limit)
        .offset(offset);

      return { entries, total, page: query.page, limit: query.limit };
    });
  });

  fastify.get("/entries/:orderId", async (request, reply) => {
    const tenantId = (request as any).tenantId as string;
    const { orderId } = request.params as { orderId: string };

    return withTenantSql(tenantId, async (tx) => {
      const entries = await tx
        .select({
          id: schema.ledgerEntries.id,
          tenantId: schema.ledgerEntries.tenantId,
          orderId: schema.ledgerEntries.orderId,
          entryType: schema.ledgerEntries.entryType,
          amountCents: schema.ledgerEntries.amountCents,
          currency: schema.ledgerEntries.currency,
          description: schema.ledgerEntries.description,
          metadata: schema.ledgerEntries.metadata,
          createdAt: schema.ledgerEntries.createdAt,
        })
        .from(schema.ledgerEntries)
        .where(eq(schema.ledgerEntries.orderId, orderId))
        .orderBy(desc(schema.ledgerEntries.createdAt));

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
      const rows = await tx.execute(
        sql`SELECT
          COUNT(*) FILTER (WHERE entry_type = 'credit')::int as credit_count,
          COALESCE(SUM(CASE WHEN entry_type = 'credit' THEN amount_cents ELSE 0 END), 0) as credit_total,
          COUNT(*) FILTER (WHERE entry_type = 'debit')::int as debit_count,
          COALESCE(SUM(CASE WHEN entry_type = 'debit' THEN amount_cents ELSE 0 END), 0) as debit_total
        FROM ledger_entries`,
      ) as Array<{
        credit_count: number;
        credit_total: bigint;
        debit_count: number;
        debit_total: bigint;
      }>;

      const summary = rows[0];
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
