import { describe, it, expect } from "vitest";
import { createResourceSchema, createOrderSchema, loginSchema, paginationSchema } from "./index.js";

describe("Zod Schemas", () => {
  describe("createResourceSchema", () => {
    it("accepts valid resource", () => {
      const result = createResourceSchema.safeParse({ name: "Test" });
      expect(result.success).toBe(true);
    });

    it("rejects empty name", () => {
      const result = createResourceSchema.safeParse({ name: "" });
      expect(result.success).toBe(false);
    });

    it("rejects missing name", () => {
      const result = createResourceSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe("createOrderSchema", () => {
    it("accepts valid order", () => {
      const result = createOrderSchema.safeParse({
        resource_variant_id: "550e8400-e29b-41d4-a716-446655440000",
        quantity: 1,
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid uuid", () => {
      const result = createOrderSchema.safeParse({
        resource_variant_id: "not-a-uuid",
        quantity: 1,
      });
      expect(result.success).toBe(false);
    });

    it("rejects zero quantity", () => {
      const result = createOrderSchema.safeParse({
        resource_variant_id: "550e8400-e29b-41d4-a716-446655440000",
        quantity: 0,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("loginSchema", () => {
    it("accepts valid login", () => {
      const result = loginSchema.safeParse({ email: "test@example.com", password: "pass" });
      expect(result.success).toBe(true);
    });

    it("rejects invalid email", () => {
      const result = loginSchema.safeParse({ email: "not-email", password: "pass" });
      expect(result.success).toBe(false);
    });
  });

  describe("paginationSchema", () => {
    it("applies defaults", () => {
      const result = paginationSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(50);
      }
    });

    it("coerces string numbers", () => {
      const result = paginationSchema.safeParse({ page: "2", limit: "10" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(2);
        expect(result.data.limit).toBe(10);
      }
    });
  });
});
