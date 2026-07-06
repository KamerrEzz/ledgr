import type { FastifyPluginAsync } from "fastify";
import { db, schema } from "@ledgr/db";
import { eq } from "drizzle-orm";
import { withTenantSql } from "../lib/tenant-sql.js";
import { validate } from "../lib/validate.js";
import { createResourceSchema, updateResourceSchema } from "../schemas/index.js";

const resourcesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/", async (request) => {
    const tenantId = (request as any).tenantId as string;
    return withTenantSql(tenantId, async (tx) => {
      return tx.select().from(schema.resources);
    });
  });

  fastify.get("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const tenantId = (request as any).tenantId as string;

    return withTenantSql(tenantId, async (tx) => {
      const [resource] = await tx
        .select()
        .from(schema.resources)
        .where(eq(schema.resources.id, id));
      if (!resource) {
        reply.code(404);
        return { error: "Resource not found" };
      }
      return resource;
    });
  });

  fastify.post("/", async (request, reply) => {
    const body = validate(createResourceSchema, request.body, reply);
    if (!body) return;
    const tenantId = (request as any).tenantId as string;

    return withTenantSql(tenantId, async (tx) => {
      const [resource] = await tx
        .insert(schema.resources)
        .values({ tenantId, name: body.name, description: body.description ?? null })
        .returning();
      reply.code(201);
      return resource;
    });
  });

  fastify.patch("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = validate(updateResourceSchema, request.body, reply);
    if (!body) return;
    const tenantId = (request as any).tenantId as string;

    return withTenantSql(tenantId, async (tx) => {
      const [existing] = await tx
        .select()
        .from(schema.resources)
        .where(eq(schema.resources.id, id));
      if (!existing) {
        reply.code(404);
        return { error: "Resource not found" };
      }

      const [updated] = await tx
        .update(schema.resources)
        .set({
          name: body.name ?? existing.name,
          description: body.description ?? existing.description,
        })
        .where(eq(schema.resources.id, id))
        .returning();
      return updated;
    });
  });

  fastify.delete("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const tenantId = (request as any).tenantId as string;

    return withTenantSql(tenantId, async (tx) => {
      const [existing] = await tx
        .select()
        .from(schema.resources)
        .where(eq(schema.resources.id, id));
      if (!existing) {
        reply.code(404);
        return { error: "Resource not found" };
      }

      const [updated] = await tx
        .update(schema.resources)
        .set({ isActive: false })
        .where(eq(schema.resources.id, id))
        .returning();
      return updated;
    });
  });
};

export default resourcesRoutes;
