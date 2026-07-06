CREATE TABLE IF NOT EXISTS order_status_transitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  from_status VARCHAR(50) NOT NULL,
  to_status VARCHAR(50) NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_order_status_transitions_order_id ON order_status_transitions(order_id);
CREATE INDEX IF NOT EXISTS idx_order_status_transitions_tenant_id ON order_status_transitions(tenant_id);
