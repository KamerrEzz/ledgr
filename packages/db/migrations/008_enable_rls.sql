ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_tenants ON tenants
  USING (id::text = current_setting('app.current_tenant_id'));

CREATE POLICY tenant_isolation_resources ON resources
  USING (tenant_id::text = current_setting('app.current_tenant_id'));

CREATE POLICY tenant_isolation_resource_variants ON resource_variants
  USING (tenant_id::text = current_setting('app.current_tenant_id'));

CREATE POLICY tenant_isolation_orders ON orders
  USING (tenant_id::text = current_setting('app.current_tenant_id'));

CREATE POLICY tenant_isolation_order_status_transitions ON order_status_transitions
  USING (tenant_id::text = current_setting('app.current_tenant_id'));

CREATE POLICY tenant_isolation_ledger_entries ON ledger_entries
  USING (tenant_id::text = current_setting('app.current_tenant_id'));

CREATE POLICY tenant_isolation_webhook_events ON webhook_events
  USING (true);
