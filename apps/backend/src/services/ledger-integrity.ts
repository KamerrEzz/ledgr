import { sql } from "@ledgr/db";

interface IntegrityError {
  type: "mismatched_entries" | "amount_mismatch" | "orphaned_entries" | "double_count_detected";
  order_id?: string;
  details: string;
}

interface IntegrityStats {
  total_entries: number;
  total_orders_with_entries: number;
  total_credits: number;
  total_debits: number;
}

interface IntegrityResult {
  isValid: boolean;
  errors: IntegrityError[];
  stats: IntegrityStats;
}

export async function validateLedgerIntegrity(tenantId: string): Promise<IntegrityResult> {
  return sql.begin(async (tx) => {
    await tx`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;

    const errors: IntegrityError[] = [];

    const [statsRow] = await tx`
      SELECT
        COUNT(*)::int as total_entries,
        COUNT(DISTINCT order_id)::int as total_orders_with_entries,
        COUNT(*) FILTER (WHERE entry_type = 'credit')::int as total_credits,
        COUNT(*) FILTER (WHERE entry_type = 'debit')::int as total_debits
      FROM ledger_entries
    `;

    const stats: IntegrityStats = {
      total_entries: statsRow.total_entries,
      total_orders_with_entries: statsRow.total_orders_with_entries,
      total_credits: statsRow.total_credits,
      total_debits: statsRow.total_debits,
    };

    const mismatchedOrders = await tx`
      SELECT order_id, COUNT(*)::int as entry_count
      FROM ledger_entries
      GROUP BY order_id
      HAVING COUNT(*) != 2
    `;

    for (const row of mismatchedOrders) {
      errors.push({
        type: "mismatched_entries",
        order_id: row.order_id,
        details: `Order ${row.order_id} has ${row.entry_count} entries, expected 2`,
      });
    }

    const amountMismatches = await tx`
      SELECT
        le.order_id,
        COALESCE(SUM(CASE WHEN le.entry_type = 'credit' THEN le.amount_cents ELSE 0 END), 0) as credit_sum,
        COALESCE(SUM(CASE WHEN le.entry_type = 'debit' THEN le.amount_cents ELSE 0 END), 0) as debit_sum,
        o.total_cents
      FROM ledger_entries le
      JOIN orders o ON o.id = le.order_id
      GROUP BY le.order_id, o.total_cents
      HAVING
        COUNT(*) = 2 AND
        COALESCE(SUM(CASE WHEN le.entry_type = 'credit' THEN le.amount_cents ELSE 0 END), 0) +
        COALESCE(SUM(CASE WHEN le.entry_type = 'debit' THEN le.amount_cents ELSE 0 END), 0) != o.total_cents
    `;

    for (const row of amountMismatches) {
      errors.push({
        type: "amount_mismatch",
        order_id: row.order_id,
        details: `Order ${row.order_id}: credit(${row.credit_sum}) + debit(${row.debit_sum}) != total(${row.total_cents})`,
      });
    }

    const orphanedEntries = await tx`
      SELECT le.id as entry_id, le.order_id
      FROM ledger_entries le
      LEFT JOIN orders o ON o.id = le.order_id
      WHERE o.id IS NULL
    `;

    for (const row of orphanedEntries) {
      errors.push({
        type: "orphaned_entries",
        order_id: row.order_id,
        details: `Ledger entry ${row.entry_id} references non-existent order ${row.order_id}`,
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      stats,
    };
  }) as Promise<IntegrityResult>;
}
