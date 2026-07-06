import { schema } from "@ledgr/db";

export async function createSplitPaymentEntries(
  tx: any,
  orderId: string,
  tenantId: string,
  totalCents: bigint,
  currency: string,
): Promise<void> {
  const platformCommission = (totalCents * 10n) / 100n;
  const tenantPayout = totalCents - platformCommission;

  await tx.insert(schema.ledgerEntries).values({
    tenantId,
    orderId,
    entryType: "credit",
    amountCents: tenantPayout,
    currency,
    description: "Tenant payout",
    metadata: { orderId },
  });

  await tx.insert(schema.ledgerEntries).values({
    tenantId,
    orderId,
    entryType: "debit",
    amountCents: platformCommission,
    currency,
    description: "Platform commission",
    metadata: { orderId },
  });
}
