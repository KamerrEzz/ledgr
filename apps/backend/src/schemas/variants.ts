import { z } from "zod";

export const createVariantSchema = z.object({
  name: z.string().min(1).max(255),
  price_cents: z.union([z.number().int().nonnegative(), z.string().regex(/^\d+$/)]),
  currency: z.string().length(3).optional().default("USD"),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const updateVariantSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  price_cents: z.union([z.number().int().nonnegative(), z.string().regex(/^\d+$/)]).optional(),
  currency: z.string().length(3).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
