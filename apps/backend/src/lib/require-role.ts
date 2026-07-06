import type { FastifyRequest, FastifyReply } from "fastify";

export function requireRole(...roles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user || !roles.includes(request.user.role)) {
      return reply.code(403).send({ error: "Insufficient permissions" });
    }
  };
}
