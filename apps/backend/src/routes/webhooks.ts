import type { FastifyPluginAsync } from "fastify";
import { randomUUID, createHash } from "node:crypto";
import { sql } from "@ledgr/db";
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
    return sql`SELECT * FROM webhook_events ORDER BY created_at DESC LIMIT 100`;
  });

  fastify.get("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const [event] = await sql`SELECT * FROM webhook_events WHERE id = ${id}`;
    if (!event) {
      reply.code(404);
      return { error: "Webhook event not found" };
    }
    return event;
  });

  fastify.post<{ Body: WebhookReceiveBody }>("/receive", async (request, reply) => {
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
      const rows = await sql`
        INSERT INTO webhook_events (source, event_type, payload, idempotency_key, status)
        VALUES (${source}, ${body.event_type}, ${JSON.stringify(body)}, ${idempotencyKey}, 'received')
        RETURNING *
      `;
      eventRow = rows[0];
    } catch (err: any) {
      if (err?.code === "23505") {
        return { status: "duplicate" };
      }
      throw err;
    }

    try {
      await sql`UPDATE webhook_events SET status = 'processing' WHERE id = ${eventRow.id}`;

      if (body.event_type === "payment.completed") {
        await processPaymentCompleted(body);
      }

      await sql`
        UPDATE webhook_events
        SET status = 'processed', processed_at = now()
        WHERE id = ${eventRow.id}
      `;

      return { status: "processed" };
    } catch (err: any) {
      await sql`
        UPDATE webhook_events
        SET status = 'failed', error_message = ${err.message || "Processing failed"}
        WHERE id = ${eventRow.id}
      `;
      return { status: "failed" };
    }
  });
};

async function processPaymentCompleted(body: WebhookReceiveBody): Promise<void> {
  await sql.begin(async (tx) => {
    await tx`SELECT set_config('app.current_tenant_id', ${body.tenant_id}, true)`;

    const [order] = await tx`SELECT * FROM orders WHERE id = ${body.order_id} FOR UPDATE`;
    if (!order) {
      throw new Error(`Order ${body.order_id} not found`);
    }

    if (!canTransition(order.status, "paid")) {
      throw new Error(
        `Cannot transition order ${body.order_id} from ${order.status} to paid`,
      );
    }

    await tx`UPDATE orders SET status = 'paid', updated_at = now() WHERE id = ${body.order_id}`;

    await tx`INSERT INTO order_status_transitions (order_id, tenant_id, from_status, to_status, reason)
      VALUES (${body.order_id}, ${body.tenant_id}, ${order.status}, 'paid', 'Payment webhook received')`;

    const totalCents = BigInt(body.amount_cents);
    const [existingCount] = await tx`SELECT COUNT(*)::int as count FROM ledger_entries WHERE order_id = ${body.order_id}`;
    if (existingCount.count > 0) {
      console.warn(`Order ${body.order_id} already has ${existingCount.count} ledger entries, skipping duplicate creation`);
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
