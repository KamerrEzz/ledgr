-- Fix RLS policies: add WITH CHECK, make ledger append-only

-- NOTE: users table intentionally has NO RLS policies.
-- The login endpoint must query users by email BEFORE knowing the tenant_id.
-- This is a deliberate tradeoff: login requires cross-tenant email lookup.
-- Security mitigations: rate limiting (30/min), password hashing, no sensitive data in responses.

-- Drop ALL existing policies
DROP POLICY IF EXISTS tenant_isolation_tenants ON tenants;
DROP POLICY IF EXISTS tenant_isolation_resources ON resources;
DROP POLICY IF EXISTS tenant_isolation_resource_variants ON resource_variants;
DROP POLICY IF EXISTS tenant_isolation_orders ON orders;
DROP POLICY IF EXISTS tenant_isolation_order_status_transitions ON order_status_transitions;
DROP POLICY IF EXISTS tenant_isolation_ledger_entries ON ledger_entries;
DROP POLICY IF EXISTS tenant_isolation_webhook_events ON webhook_events;
DROP POLICY IF EXISTS tenant_isolation_users ON users;

-- tenants: SELECT + UPDATE only (tenants are not created via app)
CREATE POLICY tenant_select ON tenants
  FOR SELECT USING (id::text = current_setting('app.current_tenant_id'));
CREATE POLICY tenant_update ON tenants
  FOR UPDATE USING (id::text = current_setting('app.current_tenant_id'));

-- resources: SELECT + INSERT + UPDATE + DELETE with WITH CHECK
CREATE POLICY tenant_select ON resources
  FOR SELECT USING (tenant_id::text = current_setting('app.current_tenant_id'));
CREATE POLICY tenant_insert ON resources
  FOR INSERT WITH CHECK (tenant_id::text = current_setting('app.current_tenant_id'));
CREATE POLICY tenant_update ON resources
  FOR UPDATE USING (tenant_id::text = current_setting('app.current_tenant_id'))
  WITH CHECK (tenant_id::text = current_setting('app.current_tenant_id'));
CREATE POLICY tenant_delete ON resources
  FOR DELETE USING (tenant_id::text = current_setting('app.current_tenant_id'));

-- resource_variants: SELECT + INSERT + UPDATE + DELETE with WITH CHECK
CREATE POLICY tenant_select ON resource_variants
  FOR SELECT USING (tenant_id::text = current_setting('app.current_tenant_id'));
CREATE POLICY tenant_insert ON resource_variants
  FOR INSERT WITH CHECK (tenant_id::text = current_setting('app.current_tenant_id'));
CREATE POLICY tenant_update ON resource_variants
  FOR UPDATE USING (tenant_id::text = current_setting('app.current_tenant_id'))
  WITH CHECK (tenant_id::text = current_setting('app.current_tenant_id'));
CREATE POLICY tenant_delete ON resource_variants
  FOR DELETE USING (tenant_id::text = current_setting('app.current_tenant_id'));

-- orders: SELECT + INSERT + UPDATE with WITH CHECK (no DELETE - orders are immutable)
CREATE POLICY tenant_select ON orders
  FOR SELECT USING (tenant_id::text = current_setting('app.current_tenant_id'));
CREATE POLICY tenant_insert ON orders
  FOR INSERT WITH CHECK (tenant_id::text = current_setting('app.current_tenant_id'));
CREATE POLICY tenant_update ON orders
  FOR UPDATE USING (tenant_id::text = current_setting('app.current_tenant_id'))
  WITH CHECK (tenant_id::text = current_setting('app.current_tenant_id'));

-- order_status_transitions: SELECT + INSERT only (immutable audit trail)
CREATE POLICY tenant_select ON order_status_transitions
  FOR SELECT USING (tenant_id::text = current_setting('app.current_tenant_id'));
CREATE POLICY tenant_insert ON order_status_transitions
  FOR INSERT WITH CHECK (tenant_id::text = current_setting('app.current_tenant_id'));

-- ledger_entries: SELECT + INSERT only (append-only, no UPDATE/DELETE policies = denied by default)
CREATE POLICY tenant_select ON ledger_entries
  FOR SELECT USING (tenant_id::text = current_setting('app.current_tenant_id'));
CREATE POLICY tenant_insert ON ledger_entries
  FOR INSERT WITH CHECK (tenant_id::text = current_setting('app.current_tenant_id'));

-- webhook_events: global read + insert (external source, no tenant isolation on read)
CREATE POLICY webhook_select ON webhook_events
  FOR SELECT USING (true);
CREATE POLICY webhook_insert ON webhook_events
  FOR INSERT WITH CHECK (true);
CREATE POLICY webhook_update ON webhook_events
  FOR UPDATE USING (true)
  WITH CHECK (true);
