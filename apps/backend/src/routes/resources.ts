import type { FastifyPluginAsync } from "fastify";
import { withTenantSql } from "../lib/tenant-sql.js";

const resourcesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/", async (request) => {
    const tenantId = (request as any).tenantId as string;
    return withTenantSql(tenantId, async (tx) => {
      return tx`SELECT * FROM resources`;
    });
  });

  fastify.get("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const tenantId = (request as any).tenantId as string;

    return withTenantSql(tenantId, async (tx) => {
      const [resource] = await tx`SELECT * FROM resources WHERE id = ${id}`;
      if (!resource) {
        reply.code(404);
        return { error: "Resource not found" };
      }
      return resource;
    });
  });

  fastify.post("/", async (request, reply) => {
    const { name, description } = request.body as {
      name: string;
      description?: string;
    };
    const tenantId = (request as any).tenantId as string;

    return withTenantSql(tenantId, async (tx) => {
      const [resource] = await tx`INSERT INTO resources (tenant_id, name, description)
        VALUES (${tenantId}, ${name}, ${description ?? null})
        RETURNING *`;
      reply.code(201);
      return resource;
    });
  });

  fastify.patch("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { name, description } = request.body as {
      name?: string;
      description?: string;
    };
    const tenantId = (request as any).tenantId as string;

    return withTenantSql(tenantId, async (tx) => {
      const [resource] = await tx`SELECT * FROM resources WHERE id = ${id}`;
      if (!resource) {
        reply.code(404);
        return { error: "Resource not found" };
      }

      const updatedName = name ?? resource.name;
      const updatedDescription = description ?? resource.description;

      const [updated] = await tx`UPDATE resources
        SET name = ${updatedName}, description = ${updatedDescription}
        WHERE id = ${id}
        RETURNING *`;
      return updated;
    });
  });

  fastify.delete("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const tenantId = (request as any).tenantId as string;

    return withTenantSql(tenantId, async (tx) => {
      const [resource] = await tx`SELECT * FROM resources WHERE id = ${id}`;
      if (!resource) {
        reply.code(404);
        return { error: "Resource not found" };
      }

      const [updated] = await tx`UPDATE resources SET is_active = false WHERE id = ${id} RETURNING *`;
      return updated;
    });
  });
};

export default resourcesRoutes;
