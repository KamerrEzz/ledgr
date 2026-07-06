import type { FastifyPluginAsync } from "fastify";
import { withTenantSql } from "../lib/tenant-sql.js";

const variantsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/", async (request) => {
    const { resourceId } = request.params as { resourceId: string };
    const tenantId = (request as any).tenantId as string;

    return withTenantSql(tenantId, async (tx) => {
      return tx`SELECT * FROM resource_variants WHERE resource_id = ${resourceId}`;
    });
  });

  fastify.get("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const tenantId = (request as any).tenantId as string;

    return withTenantSql(tenantId, async (tx) => {
      const [variant] = await tx`SELECT * FROM resource_variants WHERE id = ${id}`;
      if (!variant) {
        reply.code(404);
        return { error: "Variant not found" };
      }
      return variant;
    });
  });

  fastify.post("/", async (request, reply) => {
    const { resourceId } = request.params as { resourceId: string };
    const { name, price_cents, currency, metadata } = request.body as {
      name: string;
      price_cents: number | string;
      currency?: string;
      metadata?: Record<string, unknown>;
    };
    const tenantId = (request as any).tenantId as string;

    return withTenantSql(tenantId, async (tx) => {
      const [resource] = await tx`SELECT id FROM resources WHERE id = ${resourceId}`;
      if (!resource) {
        reply.code(404);
        return { error: "Resource not found" };
      }

      const priceCents = BigInt(price_cents);
      const metadataStr = metadata ? JSON.stringify(metadata) : "{}";

      const [variant] = await tx`INSERT INTO resource_variants (tenant_id, resource_id, name, price_cents, currency, metadata)
        VALUES (${tenantId}, ${resourceId}, ${name}, ${priceCents}, ${currency ?? "USD"}, ${metadataStr})
        RETURNING *`;

      reply.code(201);
      return variant;
    });
  });

  fastify.patch("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { name, price_cents, currency, metadata } = request.body as {
      name?: string;
      price_cents?: number | string;
      currency?: string;
      metadata?: Record<string, unknown>;
    };
    const tenantId = (request as any).tenantId as string;

    return withTenantSql(tenantId, async (tx) => {
      const [variant] = await tx`SELECT * FROM resource_variants WHERE id = ${id}`;
      if (!variant) {
        reply.code(404);
        return { error: "Variant not found" };
      }

      const updatedName = name ?? variant.name;
      const updatedPriceCents =
        price_cents !== undefined ? BigInt(price_cents) : BigInt(variant.price_cents);
      const updatedCurrency = currency ?? variant.currency;
      const updatedMetadata = metadata
        ? JSON.stringify(metadata)
        : JSON.stringify(variant.metadata ?? {});

      const [updated] = await tx`UPDATE resource_variants
        SET name = ${updatedName},
            price_cents = ${updatedPriceCents},
            currency = ${updatedCurrency},
            metadata = ${updatedMetadata}
        WHERE id = ${id}
        RETURNING *`;
      return updated;
    });
  });

  fastify.delete("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const tenantId = (request as any).tenantId as string;

    return withTenantSql(tenantId, async (tx) => {
      const [deleted] = await tx`DELETE FROM resource_variants WHERE id = ${id} RETURNING *`;
      if (!deleted) {
        reply.code(404);
        return { error: "Variant not found" };
      }
      return deleted;
    });
  });
};

export default variantsRoutes;
