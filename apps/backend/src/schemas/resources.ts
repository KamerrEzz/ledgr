import { z } from "zod";

export const createResourceSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
});

export const updateResourceSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
});
