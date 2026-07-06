import type { FastifyPluginAsync } from "fastify";
import { db, schema } from "@ledgr/db";
import { eq } from "drizzle-orm";
import { withTenantSql } from "../lib/tenant-sql.js";
import { validate } from "../lib/validate.js";
import { createVariantSchema, updateVariantSchema } from "../schemas/index.js";

const variantsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/", async (request) => {
    const { resourceId } = request.params as { resourceId: string };
    const tenantId = (request as any).tenantId as string;

    return withTenantSql(tenantId, async (tx) => {
      return tx
        .select()
        .from(schema.resourceVariants)
        .where(eq(schema.resourceVariants.resourceId, resourceId));
    });
  });

  fastify.get("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const tenantId = (request as any).tenantId as string;

    return withTenantSql(tenantId, async (tx) => {
      const [variant] = await tx
        .select()
        .from(schema.resourceVariants)
        .where(eq(schema.resourceVariants.id, id));
      if (!variant) {
        reply.code(404);
        return { error: "Variant not found" };
      }
      return variant;
    });
  });

  fastify.post("/", async (request, reply) => {
    const { resourceId } = request.params as { resourceId: string };
    const body = validate(createVariantSchema, request.body, reply);
    if (!body) return;
    const tenantId = (request as any).tenantId as string;

    return withTenantSql(tenantId, async (tx) => {
      const [resource] = await tx
        .select({ id: schema.resources.id })
        .from(schema.resources)
        .where(eq(schema.resources.id, resourceId));
      if (!resource) {
        reply.code(404);
        return { error: "Resource not found" };
      }

      const priceCents = BigInt(typeof body.price_cents === "string" ? body.price_cents : body.price_cents);

      const [variant] = await tx
        .insert(schema.resourceVariants)
        .values({
          tenantId,
          resourceId,
          name: body.name,
          priceCents,
          currency: body.currency ?? "USD",
          metadata: body.metadata ?? {},
        })
        .returning();

      reply.code(201);
      return variant;
    });
  });

  fastify.patch("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = validate(updateVariantSchema, request.body, reply);
    if (!body) return;
    const tenantId = (request as any).tenantId as string;

    return withTenantSql(tenantId, async (tx) => {
      const [existing] = await tx
        .select()
        .from(schema.resourceVariants)
        .where(eq(schema.resourceVariants.id, id));
      if (!existing) {
        reply.code(404);
        return { error: "Variant not found" };
      }

      const [updated] = await tx
        .update(schema.resourceVariants)
        .set({
          name: body.name ?? existing.name,
          priceCents:
            body.price_cents !== undefined ? BigInt(typeof body.price_cents === "string" ? body.price_cents : body.price_cents) : existing.priceCents,
          currency: body.currency ?? existing.currency,
          metadata: body.metadata ?? existing.metadata,
        })
        .where(eq(schema.resourceVariants.id, id))
        .returning();
      return updated;
    });
  });

  fastify.delete("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const tenantId = (request as any).tenantId as string;

    return withTenantSql(tenantId, async (tx) => {
      const [deleted] = await tx
        .delete(schema.resourceVariants)
        .where(eq(schema.resourceVariants.id, id))
        .returning();
      if (!deleted) {
        reply.code(404);
        return { error: "Variant not found" };
      }
      return deleted;
    });
  });
};

export default variantsRoutes;
