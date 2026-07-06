<p align="center">
  <img src="https://img.shields.io/badge/Version-0.1.0-blue" alt="Version">
  <img src="https://img.shields.io/badge/TypeScript-Full%20Stack-3178C6?logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Next.js-15-000000?logo=next.js&logoColor=white" alt="Next.js">
  <img src="https://img.shields.io/badge/Fastify-5-000000?logo=fastify&logoColor=white" alt="Fastify">
  <img src="https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL">
  <img src="https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white" alt="Redis">
</p>

<h1 align="center">Ledgr</h1>

<p align="center">
  Multi-tenant SaaS marketplace boilerplate with ledger, split payments, and webhook idempotency
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> ·
  <a href="#architecture">Architecture</a> ·
  <a href="#test-scenarios">Test Scenarios</a> ·
  <a href="#api-reference">API</a> ·
  <a href="#docs">Docs</a>
</p>

---

## What is Ledgr?

Ledgr is a **study boilerplate** demonstrating how to build a production-grade SaaS marketplace with:

- **Multi-tenancy via PostgreSQL RLS** — tenant isolation enforced at the database level, not in application code
- **Append-only ledger** — immutable financial records with split payments (90/10 tenant/platform)
- **Webhook idempotency** — handles duplicate webhook delivery like real payment gateways (Stripe, Conekta)
- **Event-driven architecture** — Redis pub/sub for async payment confirmations

The domain is **intentionally generic** — use "resources" and "items" so anyone can adapt it to their own SaaS (ticket marketplace, course platform, service marketplace, etc.).

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 (App Router) + Tailwind CSS |
| Backend | Fastify + TypeScript |
| Database | PostgreSQL 16 with Row-Level Security |
| Cache/Queues | Redis 7 |
| DB Client | postgres.js (no ORM) |
| Monorepo | pnpm workspaces + Turborepo |
| Infra | Docker Compose |

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 9.x
- Docker + Docker Compose

### Setup

```bash
git clone https://github.com/KamerrEzz/ledgr.git
cd ledgr
pnpm install

# Start Postgres + Redis
docker compose up -d

# Run migrations + seed data
cd packages/db
pnpm build
pnpm migrate
pnpm seed

# Start all services
cd ../..
pnpm dev
```

### Verify

```bash
# Backend
curl http://localhost:3001/health
# → {"status":"ok","service":"backend"}

# Frontend → http://localhost:3000
# Payment Gateway → http://localhost:3002/health
```

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│  Web :3000  │────▶│ Backend :3001│────▶│ Postgres :5432│
│  Next.js    │     │   Fastify    │     │  RLS enforced │
└─────────────┘     └──────┬───────┘     └──────────────┘
                           │
                           │ webhook
                           │
                    ┌──────▼───────┐
                    │ Payment Mock │
                    │   :3002      │
                    └──────────────┘
                           │
                    ┌──────▼───────┐
                    │  Redis :6379 │
                    │  pub/sub     │
                    └──────────────┘
```

### Multi-Tenancy with RLS

Every database query runs inside a transaction with `SET LOCAL app.current_tenant_id`. PostgreSQL RLS policies automatically filter rows — even if application code forgets `WHERE tenant_id = ?`, zero rows are returned.

```typescript
withTenantSql(tenantId, async (tx) => {
  return tx`SELECT * FROM resources`;  // RLS handles isolation
});
```

### Order State Machine

```
draft ──▶ pending_payment ──▶ paid ──▶ fulfilled ──▶ refunded
                  │
                  └──▶ failed
```

Transitions are validated and logged in `order_status_transitions` for a full audit trail.

### Append-Only Ledger

Every successful payment creates **exactly 2 entries**:
- **Credit** to tenant (90% of total)
- **Debit** for platform commission (10%)

Balance is always calculated by `SUM()` — never cached.

### Webhook Idempotency

The payment mock sends **2-3 duplicate webhooks** per successful payment (500-3000ms apart), simulating real gateway behavior. The backend deduplicates using `X-Webhook-Id` + a UNIQUE constraint on `webhook_events`.

## Test Scenarios

### 1. Multi-Tenant Isolation

```bash
# Create resource as Acme
curl -X POST http://localhost:3001/api/resources \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: a0000000-0000-0000-0000-000000000001" \
  -d '{"name": "Acme Product"}'

# Try to read as Globex → empty (RLS blocks it)
curl http://localhost:3001/api/resources \
  -H "x-tenant-id: a0000000-0000-0000-0000-000000000002"
# → []
```

### 2. Order State Machine

```bash
# Create order
curl -X POST http://localhost:3001/api/orders \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: a0000000-0000-0000-0000-000000000001" \
  -d '{"resource_variant_id":"<variant-id>","quantity":1}'

# Invalid transition (draft → fulfilled) → 400
curl -X POST http://localhost:3001/api/orders/<order-id>/transition \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: a0000000-0000-0000-0000-000000000001" \
  -d '{"to_status":"fulfilled"}'
# → {"error":"Invalid transition from 'draft' to 'fulfilled'"}
```

### 3. Webhook Deduplication

```bash
# Send same webhook twice
curl -X POST http://localhost:3001/api/webhooks/receive \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Id: test-duplicate-123" \
  -d '{"event_type":"payment.completed","order_id":"...","tenant_id":"...","amount_cents":9900,"currency":"USD"}'
# → {"status":"processed"}

# Same X-Webhook-Id → duplicate
curl -X POST http://localhost:3001/api/webhooks/receive \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Id: test-duplicate-123" \
  -d '{"event_type":"payment.completed","order_id":"...","tenant_id":"...","amount_cents":9900,"currency":"USD"}'
# → {"status":"duplicate"}
```

### 4. Ledger Integrity

```bash
curl http://localhost:3001/api/ledger/integrity \
  -H "x-tenant-id: a0000000-0000-0000-0000-000000000001"
# → {"isValid":true,"errors":[],"stats":{...}}
```

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Backend health check |
| GET | `/api/resources` | List resources |
| POST | `/api/resources` | Create resource |
| GET | `/api/resources/:id` | Get resource |
| PATCH | `/api/resources/:id` | Update resource |
| DELETE | `/api/resources/:id` | Soft-delete resource |
| GET | `/api/resources/:id/variants` | List variants |
| POST | `/api/resources/:id/variants` | Create variant |
| PATCH | `/api/resources/:id/variants/:id` | Update variant |
| DELETE | `/api/resources/:id/variants/:id` | Delete variant |
| GET | `/api/orders` | List orders |
| POST | `/api/orders` | Create order |
| GET | `/api/orders/:id` | Get order + transitions |
| POST | `/api/orders/:id/transition` | Transition order status |
| GET | `/api/balance` | Real-time balance |
| GET | `/api/balance/history` | Daily balance (30 days) |
| GET | `/api/ledger` | Ledger entries (paginated) |
| GET | `/api/ledger/summary` | Ledger aggregate summary |
| GET | `/api/ledger/entries/:orderId` | Entries for specific order |
| GET | `/api/ledger/integrity` | Ledger integrity check |
| GET | `/api/webhooks` | Recent webhook events |
| GET | `/api/webhooks/:id` | Webhook event detail |
| POST | `/api/webhooks/receive` | Ingest webhook (no auth) |

All endpoints except `/health` and `/api/webhooks/receive` require the `x-tenant-id` header.

## Project Structure

```
ledgr/
├── apps/
│   ├── backend/              # Fastify API
│   │   └── src/
│   │       ├── routes/       # REST endpoints
│   │       ├── services/     # Business logic
│   │       ├── consumers/    # Redis event consumers
│   │       └── lib/          # Utilities (withTenantSql)
│   ├── web/                  # Next.js dashboard
│   │   └── src/
│   │       ├── app/          # App Router pages
│   │       ├── components/   # Reusable UI components
│   │       └── lib/          # API client, formatting, context
│   └── payment-gateway-mock/ # Simulated payment gateway
├── packages/
│   ├── db/                   # Schema, migrations, seeds, runners
│   ├── shared-types/         # TypeScript types
│   └── event-bus/            # Redis pub/sub wrapper
├── docs/
│   ├── ARCHITECTURE.md       # Decision records
│   ├── ERD.md                # Mermaid diagram
│   └── HANDOFF.md            # Getting started guide
├── docker-compose.yml
└── turbo.json
```

## Docs

- **[ARCHITECTURE.md](docs/ARCHITECTURE.md)** — Why each decision was made (RLS, append-only ledger, state machine, idempotency)
- **[ERD.md](docs/ERD.md)** — Mermaid entity-relationship diagram
- **[HANDOFF.md](docs/HANDOFF.md)** — Step-by-step guide to run, test, and understand the project
- **[CHANGELOG.md](CHANGELOG.md)** — Version history

## License

MIT
