CREATE TABLE IF NOT EXISTS resource_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  price_cents BIGINT NOT NULL CHECK (price_cents >= 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_resource_variants_resource_id ON resource_variants(resource_id);
CREATE INDEX IF NOT EXISTS idx_resource_variants_tenant_id ON resource_variants(tenant_id);
