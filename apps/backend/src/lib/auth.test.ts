import { describe, it, expect } from "vitest";
import { generateAccessToken, verifyAccessToken, hashPassword, verifyPassword } from "./auth.js";

describe("Auth Library", () => {
  const testPayload = {
    sub: "user-123",
    email: "test@example.com",
    role: "admin",
    tenant_id: "tenant-123",
    tenant_slug: "acme",
  };

  describe("JWT", () => {
    it("generates and verifies access token", async () => {
      const token = await generateAccessToken(testPayload);
      const verified = await verifyAccessToken(token);
      expect(verified).toBeDefined();
      expect(verified.sub).toBe("user-123");
      expect(verified.email).toBe("test@example.com");
    });

    it("rejects invalid token", async () => {
      await expect(verifyAccessToken("invalid-token")).rejects.toThrow();
    });
  });

  describe("Password hashing", () => {
    it("hashes and verifies password", () => {
      const hash = hashPassword("mypassword");
      expect(hash).not.toBe("mypassword");
      const valid = verifyPassword("mypassword", hash);
      expect(valid).toBe(true);
    });

    it("rejects wrong password", () => {
      const hash = hashPassword("mypassword");
      const valid = verifyPassword("wrongpassword", hash);
      expect(valid).toBe(false);
    });
  });
});
