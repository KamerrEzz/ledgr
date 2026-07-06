export async function createSplitPaymentEntries(
  tx: any,
  orderId: string,
  tenantId: string,
  totalCents: bigint,
  currency: string,
): Promise<void> {
  const platformCommission = (totalCents * 10n) / 100n;
  const tenantPayout = totalCents - platformCommission;

  await tx`INSERT INTO ledger_entries (tenant_id, order_id, entry_type, amount_cents, currency, description, metadata)
    VALUES (${tenantId}, ${orderId}, 'credit', ${tenantPayout}, ${currency}, 'Tenant payout', ${JSON.stringify({ orderId })})`;

  await tx`INSERT INTO ledger_entries (tenant_id, order_id, entry_type, amount_cents, currency, description, metadata)
    VALUES (${tenantId}, ${orderId}, 'debit', ${platformCommission}, ${currency}, 'Platform commission', ${JSON.stringify({ orderId })})`;
}
