# v0.1.0 — Initial Release

Ledgr is a multi-tenant SaaS marketplace boilerplate demonstrating how to build a production-grade platform with isolated tenant data, split payments, an append-only ledger, and an event-driven payment pipeline.

## What's Included

### Multi-Tenant Database (PostgreSQL 16 + RLS)
- 7 tables with real Row-Level Security — tenant isolation enforced at the database level
- No "WHERE tenant_id = ?" fragility; PostgreSQL silently returns zero rows for cross-tenant queries

### Backend API (Fastify)
- Full CRUD for resources and variants
- Order state machine: `draft → pending_payment → paid → fulfilled → refunded / failed`
- Balance calculated in real-time from ledger entries (never cached)
- Ledger integrity validator

### Payment Gateway Mock
- Simulates real-world payment gateways (Stripe/Conekta) with async webhook delivery
- Sends 2-3 duplicate webhooks per successful payment to test idempotency
- 8% random failure rate for resilience testing

### Append-Only Ledger
- Split payments: 90% tenant / 10% platform commission
- Every payment generates exactly 2 entries (credit + debit)
- Integrity checks verify amounts and detect orphaned entries

### Next.js Dashboard
- Tenant selection with 3 demo tenants (Acme, Globex, Initech)
- Views for resources, orders, balance, ledger, and webhook events
- Clean, generic design — no domain-specific language

### Documentation
- Architecture decision records explaining WHY each choice was made
- Mermaid ERD diagram
- Getting-started guide with 6 copy-paste test scenarios

## Quick Start

```bash
git clone <repo-url> && cd ledgr
pnpm install
docker compose up -d
cd packages/db && pnpm migrate && pnpm seed
cd ../.. && pnpm dev
```

Open http://localhost:3000, select a tenant, and explore the dashboard.

## Test Multi-Tenant Isolation

```bash
# Create resource as Acme
curl -X POST http://localhost:3001/api/resources \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: a0000000-0000-0000-0000-000000000001" \
  -d '{"name": "Test Product"}'

# Try to read as Globex — returns empty (RLS blocks it)
curl http://localhost:3001/api/resources \
  -H "x-tenant-id: a0000000-0000-0000-0000-000000000002"
```

## Tech Stack

- TypeScript (full stack)
- Next.js 15 (App Router)
- Fastify
- PostgreSQL 16 with RLS
- Redis 7
- postgres.js
- pnpm workspaces + Turborepo
- Docker Compose
