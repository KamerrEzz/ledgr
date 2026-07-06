import { describe, it, expect } from "vitest";
import { canTransition, getValidTransitions, VALID_TRANSITIONS } from "./order-state-machine.js";

describe("Order State Machine", () => {
  describe("canTransition", () => {
    it("allows draft → pending_payment", () => {
      expect(canTransition("draft", "pending_payment")).toBe(true);
    });

    it("allows pending_payment → paid", () => {
      expect(canTransition("pending_payment", "paid")).toBe(true);
    });

    it("allows pending_payment → failed", () => {
      expect(canTransition("pending_payment", "failed")).toBe(true);
    });

    it("allows paid → fulfilled", () => {
      expect(canTransition("paid", "fulfilled")).toBe(true);
    });

    it("allows fulfilled → refunded", () => {
      expect(canTransition("fulfilled", "refunded")).toBe(true);
    });

    it("rejects draft → paid (skipping pending_payment)", () => {
      expect(canTransition("draft", "paid")).toBe(false);
    });

    it("rejects draft → fulfilled", () => {
      expect(canTransition("draft", "fulfilled")).toBe(false);
    });

    it("rejects failed → anything (terminal state)", () => {
      expect(canTransition("failed", "paid")).toBe(false);
      expect(canTransition("failed", "draft")).toBe(false);
    });

    it("rejects refunded → anything (terminal state)", () => {
      expect(canTransition("refunded", "paid")).toBe(false);
    });

    it("rejects unknown status", () => {
      expect(canTransition("unknown", "paid")).toBe(false);
    });
  });

  describe("getValidTransitions", () => {
    it("returns pending_payment for draft", () => {
      expect(getValidTransitions("draft")).toEqual(["pending_payment"]);
    });

    it("returns [paid, failed] for pending_payment", () => {
      expect(getValidTransitions("pending_payment")).toEqual(["paid", "failed"]);
    });

    it("returns empty array for terminal states", () => {
      expect(getValidTransitions("failed")).toEqual([]);
      expect(getValidTransitions("refunded")).toEqual([]);
    });
  });

  describe("VALID_TRANSITIONS completeness", () => {
    it("has entries for all expected statuses", () => {
      const expectedStatuses = ["draft", "pending_payment", "paid", "fulfilled", "failed", "refunded"];
      for (const status of expectedStatuses) {
        expect(VALID_TRANSITIONS).toHaveProperty(status);
      }
    });
  });
});
