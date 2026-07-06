import type { FastifyReply } from "fastify";
import { type ZodSchema, ZodError } from "zod";

export function validate<T>(schema: ZodSchema<T>, data: unknown, reply: FastifyReply): T | null {
  try {
    return schema.parse(data);
  } catch (err) {
    if (err instanceof ZodError) {
      reply.code(400).send({
        error: "Validation failed",
        details: err.issues.map((e) => ({
          field: e.path.join("."),
          message: e.message,
          code: e.code,
        })),
      });
    } else {
      reply.code(500).send({ error: "Internal validation error" });
    }
    return null;
  }
}
