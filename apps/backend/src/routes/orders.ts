import type { FastifyPluginAsync } from "fastify";
import { db, schema } from "@ledgr/db";
import { eq, count, desc, asc } from "drizzle-orm";
import { withTenantSql } from "../lib/tenant-sql.js";
import { canTransition } from "../services/order-state-machine.js";
import { createSplitPaymentEntries } from "../services/ledger.js";
import { validate } from "../lib/validate.js";
import { createOrderSchema, transitionOrderSchema, paginationSchema } from "../schemas/index.js";

const ordersRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/", async (request, reply) => {
    const query = validate(paginationSchema, request.query, reply);
    if (!query) return;
    const tenantId = (request as any).tenantId as string;
    return withTenantSql(tenantId, async (tx) => {
      return tx
        .select()
        .from(schema.orders)
        .orderBy(desc(schema.orders.createdAt));
    });
  });

  fastify.get("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const tenantId = (request as any).tenantId as string;

    return withTenantSql(tenantId, async (tx) => {
      const [order] = await tx
        .select()
        .from(schema.orders)
        .where(eq(schema.orders.id, id));
      if (!order) {
        reply.code(404);
        return { error: "Order not found" };
      }

      const transitions = await tx
        .select()
        .from(schema.orderStatusTransitions)
        .where(eq(schema.orderStatusTransitions.orderId, id))
        .orderBy(asc(schema.orderStatusTransitions.createdAt));

      return { ...order, transitions };
    });
  });

  fastify.post("/", async (request, reply) => {
    const body = validate(createOrderSchema, request.body, reply);
    if (!body) return;
    const tenantId = (request as any).tenantId as string;

    return withTenantSql(tenantId, async (tx) => {
      if (body.idempotency_key) {
        const [existing] = await tx
          .select()
          .from(schema.orders)
          .where(eq(schema.orders.idempotencyKey, body.idempotency_key));
        if (existing) {
          return existing;
        }
      }

      const [variant] = await tx
        .select({
          priceCents: schema.resourceVariants.priceCents,
          currency: schema.resourceVariants.currency,
        })
        .from(schema.resourceVariants)
        .where(eq(schema.resourceVariants.id, body.resource_variant_id));
      if (!variant) {
        reply.code(404);
        return { error: "Variant not found" };
      }

      const totalCents = variant.priceCents * BigInt(body.quantity);

      const [order] = await tx
        .insert(schema.orders)
        .values({
          tenantId,
          resourceVariantId: body.resource_variant_id,
          quantity: body.quantity,
          totalCents,
          currency: variant.currency,
          status: "draft",
          idempotencyKey: body.idempotency_key ?? null,
        })
        .returning();

      reply.code(201);
      return order;
    });
  });

  fastify.post("/:id/transition", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = validate(transitionOrderSchema, request.body, reply);
    if (!body) return;
    const tenantId = (request as any).tenantId as string;

    return withTenantSql(tenantId, async (tx) => {
      const [order] = await tx
        .select()
        .from(schema.orders)
        .where(eq(schema.orders.id, id));
      if (!order) {
        reply.code(404);
        return { error: "Order not found" };
      }

      if (!canTransition(order.status, body.to_status)) {
        reply.code(400);
        return {
          error: `Invalid transition from '${order.status}' to '${body.to_status}'`,
        };
      }

      await tx
        .update(schema.orders)
        .set({ status: body.to_status, updatedAt: new Date() })
        .where(eq(schema.orders.id, id));

      await tx.insert(schema.orderStatusTransitions).values({
        orderId: id,
        tenantId,
        fromStatus: order.status,
        toStatus: body.to_status,
        reason: body.reason ?? null,
      });

      if (body.to_status === "paid") {
        const [existingEntries] = await tx
          .select({ count: count() })
          .from(schema.ledgerEntries)
          .where(eq(schema.ledgerEntries.orderId, id));
        if (existingEntries && existingEntries.count > 0) {
          console.warn(
            `Order ${id} already has ${existingEntries.count} ledger entries, skipping duplicate creation`,
          );
        } else {
          const totalCents = order.totalCents;
          await createSplitPaymentEntries(
            tx,
            id,
            tenantId,
            totalCents,
            order.currency,
          );
        }
      }

      const [updated] = await tx
        .select()
        .from(schema.orders)
        .where(eq(schema.orders.id, id));
      return updated;
    });
  });
};

export default ordersRoutes;
