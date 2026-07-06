import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { ZodError } from "zod";
import authRoutes from "./routes/auth.js";
import resourcesRoutes from "./routes/resources.js";
import variantsRoutes from "./routes/variants.js";
import ordersRoutes from "./routes/orders.js";
import balanceRoutes from "./routes/balance.js";
import webhooksRoutes from "./routes/webhooks.js";
import ledgerRoutes from "./routes/ledger.js";
import { authenticate } from "./lib/authenticate.js";
import { startPaymentConsumer } from "./consumers/payment-confirmations.js";

const server = Fastify({ logger: true });

server.setErrorHandler((err, _request, reply) => {
  if (err instanceof ZodError) {
    reply.code(400).send({
      error: "Validation failed",
      details: err.issues.map((e) => ({
        field: e.path.join("."),
        message: e.message,
        code: e.code,
      })),
    });
    return;
  }
  console.error("Unhandled error:", err);
  reply.code(500).send({ error: "Internal server error" });
});

await server.register(cors, {
  origin: ["http://localhost:3000", "http://127.0.0.1:3000"],
  credentials: true,
});
await server.register(rateLimit, {
  max: 100,
  timeWindow: "1 minute",
});

server.get("/health", async () => {
  return { status: "ok", service: "backend" };
});

const PUBLIC_PATHS = ["/health", "/api/webhooks/receive"];

server.addHook("preHandler", async (request, reply) => {
  if (PUBLIC_PATHS.some((p) => request.url.startsWith(p))) {
    return;
  }

  if (request.url.startsWith("/api/auth")) {
    return;
  }

  await authenticate(request, reply);

  if (reply.sent) return;

  if (request.user?.tenant_id) {
    (request as any).tenantId = request.user.tenant_id;
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

await server.register(authRoutes, { prefix: "/api/auth" });
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
