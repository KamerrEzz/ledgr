import type { FastifyPluginAsync } from "fastify";
import { randomUUID, createHash } from "node:crypto";
import { db, schema } from "@ledgr/db";
import { eq, sql, count } from "drizzle-orm";
import { canTransition } from "../services/order-state-machine.js";
import { createSplitPaymentEntries } from "../services/ledger.js";

interface WebhookReceiveBody {
  event_type: string;
  transaction_id: string;
  order_id: string;
  tenant_id: string;
  amount_cents: number;
  currency: string;
  timestamp: string;
}

const webhooksRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/", async () => {
    return db
      .select()
      .from(schema.webhookEvents)
      .orderBy(schema.webhookEvents.createdAt)
      .limit(100);
  });

  fastify.get("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const [event] = await db
      .select()
      .from(schema.webhookEvents)
      .where(eq(schema.webhookEvents.id, id));
    if (!event) {
      reply.code(404);
      return { error: "Webhook event not found" };
    }
    return event;
  });

  fastify.post<{ Body: WebhookReceiveBody }>(
    "/receive",
    { config: { rateLimit: false } },
    async (request, reply) => {
    const webhookIdHeader = request.headers["x-webhook-id"];
    const source = request.headers["x-webhook-source"] || "unknown";
    const body = request.body;

    const idempotencyKey =
      typeof webhookIdHeader === "string" && webhookIdHeader
        ? webhookIdHeader
        : createHash("sha256")
            .update(JSON.stringify(body))
            .digest("hex");

    let eventRow;
    try {
      const [inserted] = await db
        .insert(schema.webhookEvents)
        .values({
          source: source as string,
          eventType: body.event_type,
          payload: body as any,
          idempotencyKey,
          status: "received",
        })
        .returning();
      eventRow = inserted;
    } catch (err: any) {
      if (err?.code === "23505") {
        return { status: "duplicate" };
      }
      throw err;
    }

    try {
      await db
        .update(schema.webhookEvents)
        .set({ status: "processing" })
        .where(eq(schema.webhookEvents.id, eventRow.id));

      if (body.event_type === "payment.completed") {
        await processPaymentCompleted(body);
      }

      await db
        .update(schema.webhookEvents)
        .set({ status: "processed", processedAt: new Date() })
        .where(eq(schema.webhookEvents.id, eventRow.id));

      return { status: "processed" };
    } catch (err: any) {
      await db
        .update(schema.webhookEvents)
        .set({ status: "failed", errorMessage: err.message || "Processing failed" })
        .where(eq(schema.webhookEvents.id, eventRow.id));
      return { status: "failed" };
    }
  });
};

async function processPaymentCompleted(body: WebhookReceiveBody): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT set_config('app.current_tenant_id', ${body.tenant_id}, true)`,
    );

    const [order] = await tx
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.id, body.order_id))
      .for("update");
    if (!order) {
      throw new Error(`Order ${body.order_id} not found`);
    }

    if (!canTransition(order.status, "paid")) {
      throw new Error(
        `Cannot transition order ${body.order_id} from ${order.status} to paid`,
      );
    }

    await tx
      .update(schema.orders)
      .set({ status: "paid", updatedAt: new Date() })
      .where(eq(schema.orders.id, body.order_id));

    await tx.insert(schema.orderStatusTransitions).values({
      orderId: body.order_id,
      tenantId: body.tenant_id,
      fromStatus: order.status,
      toStatus: "paid",
      reason: "Payment webhook received",
    });

    const totalCents = BigInt(body.amount_cents);
    const [existingCount] = await tx
      .select({ count: count() })
      .from(schema.ledgerEntries)
      .where(eq(schema.ledgerEntries.orderId, body.order_id));
    if (existingCount && existingCount.count > 0) {
      console.warn(
        `Order ${body.order_id} already has ${existingCount.count} ledger entries, skipping duplicate creation`,
      );
    } else {
      await createSplitPaymentEntries(
        tx,
        body.order_id,
        body.tenant_id,
        totalCents,
        body.currency,
      );
    }
  });
}

export default webhooksRoutes;
