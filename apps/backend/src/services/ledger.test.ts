import { describe, it, expect } from "vitest";

describe("Ledger Split Payment", () => {
  function calculateSplit(totalCents: bigint): { tenantPayout: bigint; platformCommission: bigint } {
    const platformCommission = (totalCents * 10n) / 100n;
    const tenantPayout = totalCents - platformCommission;
    return { tenantPayout, platformCommission };
  }

  it("splits 10000 cents (90/10)", () => {
    const { tenantPayout, platformCommission } = calculateSplit(10000n);
    expect(tenantPayout).toBe(9000n);
    expect(platformCommission).toBe(1000n);
  });

  it("splits 9900 cents correctly", () => {
    const { tenantPayout, platformCommission } = calculateSplit(9900n);
    expect(tenantPayout).toBe(8910n);
    expect(platformCommission).toBe(990n);
  });

  it("splits 1 cent (rounding)", () => {
    const { tenantPayout, platformCommission } = calculateSplit(1n);
    expect(platformCommission).toBe(0n);
    expect(tenantPayout).toBe(1n);
  });

  it("splits 10 cents", () => {
    const { tenantPayout, platformCommission } = calculateSplit(10n);
    expect(platformCommission).toBe(1n);
    expect(tenantPayout).toBe(9n);
  });

  it("splits 99 cents", () => {
    const { tenantPayout, platformCommission } = calculateSplit(99n);
    expect(platformCommission).toBe(9n);
    expect(tenantPayout).toBe(90n);
  });

  it("split math always adds up to total", () => {
    const amounts = [1n, 10n, 99n, 100n, 999n, 1000n, 9900n, 10000n, 99999n, 100000n];
    for (const total of amounts) {
      const { tenantPayout, platformCommission } = calculateSplit(total);
      expect(tenantPayout + platformCommission).toBe(total);
    }
  });
});
