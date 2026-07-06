CREATE TABLE IF NOT EXISTS ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id),
  entry_type VARCHAR(50) NOT NULL CHECK (entry_type IN ('credit', 'debit')),
  amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  description TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_tenant_id ON ledger_entries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_order_id ON ledger_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_created_at ON ledger_entries(created_at);
