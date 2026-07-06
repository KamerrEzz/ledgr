import Fastify from "fastify";
import cors from "@fastify/cors";
import { randomUUID } from "node:crypto";

interface ChargeBody {
  amount_cents: number;
  currency: string;
  order_id: string;
  tenant_id: string;
  callback_url: string;
}

interface WebhookPayload {
  event_type: "payment.completed" | "payment.failed";
  transaction_id: string;
  order_id: string;
  tenant_id: string;
  amount_cents: number;
  currency: string;
  timestamp: string;
}

const server = Fastify({ logger: true });

await server.register(cors);

server.get("/health", async () => {
  return { status: "ok", service: "payment-gateway-mock" };
});

server.post<{ Body: ChargeBody }>("/charge", async (request, reply) => {
  const { amount_cents, currency, order_id, tenant_id, callback_url } =
    request.body;

  if (
    typeof amount_cents !== "number" ||
    amount_cents <= 0 ||
    typeof currency !== "string" ||
    !currency ||
    typeof order_id !== "string" ||
    !order_id ||
    typeof tenant_id !== "string" ||
    !tenant_id ||
    typeof callback_url !== "string" ||
    !callback_url
  ) {
    reply.code(400);
    return { error: "Missing or invalid required fields" };
  }

  const transaction_id = randomUUID();
  const webhookId = randomUUID();
  const isFailed = Math.random() < 0.08;

  if (isFailed) {
    const payload: WebhookPayload = {
      event_type: "payment.failed",
      transaction_id,
      order_id,
      tenant_id,
      amount_cents,
      currency,
      timestamp: new Date().toISOString(),
    };
    sendWebhook(callback_url, payload, 1000, webhookId);
  } else {
    const duplicateCount = Math.floor(Math.random() * 2) + 2;
    for (let i = 0; i < duplicateCount; i++) {
      const delay = 500 + Math.random() * 2500;
      const payload: WebhookPayload = {
        event_type: "payment.completed",
        transaction_id,
        order_id,
        tenant_id,
        amount_cents,
        currency,
        timestamp: new Date().toISOString(),
      };
      sendWebhook(callback_url, payload, delay, webhookId);
    }
  }

  return { status: "processing", transaction_id };
});

async function sendWebhook(
  callbackUrl: string,
  payload: WebhookPayload,
  delayMs: number,
  webhookId: string,
  attempt = 0,
): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, delayMs));

  try {
    const response = await fetch(callbackUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Id": webhookId,
        "X-Webhook-Source": "payment-gateway-mock",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Webhook returned ${response.status}`);
    }

    server.log.info(
      { webhookId, eventType: payload.event_type, transactionId: payload.transaction_id },
      "Webhook delivered successfully",
    );
  } catch (err) {
    server.log.error({ err, webhookId }, "Webhook delivery failed");

    if (attempt < 1) {
      sendWebhook(callbackUrl, payload, 1000, webhookId, attempt + 1);
    }
  }
}

const port = Number(process.env.PORT) || 3002;

try {
  await server.listen({ port, host: "0.0.0.0" });
} catch (err) {
  server.log.error(err);
  process.exit(1);
}
