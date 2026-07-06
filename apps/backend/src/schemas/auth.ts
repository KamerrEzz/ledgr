import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  tenant_id: z.string().uuid(),
  role: z.enum(["admin", "member", "viewer"]).optional().default("member"),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
