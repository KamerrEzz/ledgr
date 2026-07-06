CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source VARCHAR(100) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  idempotency_key VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'processing', 'processed', 'failed', 'duplicate')),
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_events_idempotency_key ON webhook_events(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_webhook_events_status ON webhook_events(status);
