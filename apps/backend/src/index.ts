import Fastify from "fastify";
import cors from "@fastify/cors";
import resourcesRoutes from "./routes/resources.js";
import variantsRoutes from "./routes/variants.js";
import ordersRoutes from "./routes/orders.js";
import balanceRoutes from "./routes/balance.js";
import webhooksRoutes from "./routes/webhooks.js";
import ledgerRoutes from "./routes/ledger.js";
import { startPaymentConsumer } from "./consumers/payment-confirmations.js";

const server = Fastify({ logger: true });

await server.register(cors);

server.get("/health", async () => {
  return { status: "ok", service: "backend" };
});

server.addHook("preHandler", async (request, reply) => {
  if (request.url === "/health" || request.url === "/api/webhooks/receive") {
    return;
  }

  const tenantId = request.headers["x-tenant-id"];
  if (!tenantId || typeof tenantId !== "string") {
    return reply
      .code(400)
      .send({ error: "Missing or invalid x-tenant-id header" });
  }
  (request as any).tenantId = tenantId;
});

await server.register(resourcesRoutes, { prefix: "/api/resources" });
await server.register(variantsRoutes, {
  prefix: "/api/resources/:resourceId/variants",
});
await server.register(ordersRoutes, { prefix: "/api/orders" });
await server.register(balanceRoutes, { prefix: "/api/balance" });
await server.register(ledgerRoutes, { prefix: "/api/ledger" });
await server.register(webhooksRoutes, { prefix: "/api/webhooks" });

startPaymentConsumer();

const port = Number(process.env.PORT) || 3001;

try {
  await server.listen({ port, host: "0.0.0.0" });
} catch (err) {
  server.log.error(err);
  process.exit(1);
}
