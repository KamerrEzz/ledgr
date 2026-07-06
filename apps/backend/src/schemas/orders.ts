import { z } from "zod";

export const createOrderSchema = z.object({
  resource_variant_id: z.string().uuid(),
  quantity: z.number().int().positive(),
  idempotency_key: z.string().max(255).optional(),
});

export const transitionOrderSchema = z.object({
  to_status: z.enum(["pending_payment", "paid", "failed", "fulfilled", "refunded"]),
  reason: z.string().max(500).optional(),
});
