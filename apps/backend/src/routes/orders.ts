import type { FastifyPluginAsync } from "fastify";
import { withTenantSql } from "../lib/tenant-sql.js";
import { canTransition } from "../services/order-state-machine.js";
import { createSplitPaymentEntries } from "../services/ledger.js";

const ordersRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/", async (request) => {
    const tenantId = (request as any).tenantId as string;
    return withTenantSql(tenantId, async (tx) => {
      return tx`SELECT * FROM orders ORDER BY created_at DESC`;
    });
  });

  fastify.get("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const tenantId = (request as any).tenantId as string;

    return withTenantSql(tenantId, async (tx) => {
      const [order] = await tx`SELECT * FROM orders WHERE id = ${id}`;
      if (!order) {
        reply.code(404);
        return { error: "Order not found" };
      }

      const transitions =
        await tx`SELECT * FROM order_status_transitions WHERE order_id = ${id} ORDER BY created_at ASC`;

      return { ...order, transitions };
    });
  });

  fastify.post("/", async (request, reply) => {
    const { resource_variant_id, quantity, idempotency_key } = request.body as {
      resource_variant_id: string;
      quantity: number;
      idempotency_key?: string;
    };
    const tenantId = (request as any).tenantId as string;

    return withTenantSql(tenantId, async (tx) => {
      if (idempotency_key) {
        const [existing] =
          await tx`SELECT * FROM orders WHERE idempotency_key = ${idempotency_key}`;
        if (existing) {
          return existing;
        }
      }

      const [variant] =
        await tx`SELECT price_cents, currency FROM resource_variants WHERE id = ${resource_variant_id}`;
      if (!variant) {
        reply.code(404);
        return { error: "Variant not found" };
      }

      const totalCents = BigInt(variant.price_cents) * BigInt(quantity);

      const [order] = await tx`INSERT INTO orders (tenant_id, resource_variant_id, quantity, total_cents, currency, status, idempotency_key)
        VALUES (${tenantId}, ${resource_variant_id}, ${quantity}, ${totalCents}, ${variant.currency}, 'draft', ${idempotency_key ?? null})
        RETURNING *`;

      reply.code(201);
      return order;
    });
  });

  fastify.post("/:id/transition", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { to_status, reason } = request.body as {
      to_status: string;
      reason?: string;
    };
    const tenantId = (request as any).tenantId as string;

    return withTenantSql(tenantId, async (tx) => {
      const [order] = await tx`SELECT * FROM orders WHERE id = ${id}`;
      if (!order) {
        reply.code(404);
        return { error: "Order not found" };
      }

      if (!canTransition(order.status, to_status)) {
        reply.code(400);
        return {
          error: `Invalid transition from '${order.status}' to '${to_status}'`,
        };
      }

      await tx`UPDATE orders SET status = ${to_status}, updated_at = now() WHERE id = ${id}`;

      await tx`INSERT INTO order_status_transitions (order_id, tenant_id, from_status, to_status, reason)
        VALUES (${id}, ${tenantId}, ${order.status}, ${to_status}, ${reason ?? null})`;

      if (to_status === "paid") {
        const [existingEntries] = await tx`SELECT COUNT(*)::int as count FROM ledger_entries WHERE order_id = ${id}`;
        if (existingEntries.count > 0) {
          console.warn(`Order ${id} already has ${existingEntries.count} ledger entries, skipping duplicate creation`);
        } else {
          const totalCents = BigInt(order.total_cents);
          await createSplitPaymentEntries(tx, id, tenantId, totalCents, order.currency);
        }
      }

      const [updated] = await tx`SELECT * FROM orders WHERE id = ${id}`;
      return updated;
    });
  });
};

export default ordersRoutes;
