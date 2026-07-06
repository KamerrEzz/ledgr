# Ledgr — Getting Started

## Prerequisites

- **Node.js** 20 or later
- **pnpm** 9.x (the repo specifies `packageManager: pnpm@9.15.4`)
- **Docker** and **Docker Compose** (for PostgreSQL and Redis)

## Quick Start

```bash
# 1. Clone and install
git clone <repo-url>
cd ledgr
pnpm install

# 2. Start infrastructure (PostgreSQL 16 + Redis 7)
docker compose up -d

# 3. Run migrations
cd packages/db
pnpm build
pnpm migrate

# 4. Seed test data
pnpm seed

# 5. Start all services
cd ../..
pnpm dev
```

## Verify It Works

```bash
# Backend health
curl http://localhost:3001/health

# Frontend
# Open http://localhost:3000 in your browser

# Payment gateway mock
curl http://localhost:3002/health
```

All three should return `{ "status": "ok" }`.

## Test Multi-Tenant Isolation

This test proves that RLS prevents Tenant B from seeing Tenant A's data.

**Step 1: Create a resource as Tenant A (Acme)**

```bash
curl -s -X POST http://localhost:3001/api/resources \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: a0000000-0000-0000-0000-000000000001" \
  -d '{"name": "Test Product", "description": "Created by Acme"}' | jq
```

Save the `id` from the response — you will need it in the next steps.

**Step 2: Try to read it as Tenant B (Globex)**

```bash
curl -s http://localhost:3001/api/resources/<resource-id> \
  -H "x-tenant-id: a0000000-0000-0000-0000-000000000002" | jq
```

Expected response: `404` — `"Resource not found"`. The resource exists, but RLS hides it from Globex.

**Step 3: Read it as Tenant A (Acme)**

```bash
curl -s http://localhost:3001/api/resources/<resource-id> \
  -H "x-tenant-id: a0000000-0000-0000-0000-000000000001" | jq
```

Expected response: the full resource object with `name: "Test Product"`.

**Why this works:** PostgreSQL RLS filters rows based on `app.current_tenant_id`. The query `SELECT * FROM resources WHERE id = <id>` returns a row for Acme but returns nothing for Globex because Globex's `tenant_id` does not match Acme's UUID. The database enforces this — not the application.

## Test Order State Machine

**Step 1: Create an order (status: draft)**

```bash
curl -s -X POST http://localhost:3001/api/orders \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: a0000000-0000-0000-0000-000000000001" \
  -d '{"resource_variant_id": "c0000000-0000-0000-0000-000000000001", "quantity": 2}' | jq
```

The response shows `"status": "draft"`. Save the `id`.

**Step 2: Try to transition directly to 'fulfilled' — should fail**

```bash
curl -s -X POST http://localhost:3001/api/orders/<order-id>/transition \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: a0000000-0000-0000-0000-000000000001" \
  -d '{"to_status": "fulfilled"}' | jq
```

Expected: `400` — `"Invalid transition from 'draft' to 'fulfilled'"`. The state machine rejects illegal jumps.

**Step 3: Transition draft → pending_payment → paid — should succeed**

```bash
# draft → pending_payment
curl -s -X POST http://localhost:3001/api/orders/<order-id>/transition \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: a0000000-0000-0000-0000-000000000001" \
  -d '{"to_status": "pending_payment", "reason": "Customer submitted order"}' | jq

# pending_payment → paid
curl -s -X POST http://localhost:3001/api/orders/<order-id>/transition \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: a0000000-0000-0000-0000-000000000001" \
  -d '{"to_status": "paid", "reason": "Payment confirmed"}' | jq
```

Both return `200` with the updated order.

**Step 4: Check ledger entries**

```bash
curl -s http://localhost:3001/api/ledger/entries/<order-id> \
  -H "x-tenant-id: a0000000-0000-0000-0000-000000000001" | jq
```

Expected: 2 entries — one `credit` (tenant payout, 90%) and one `debit` (platform commission, 10%).

## Test Webhook Idempotency

**Step 1: Send the same webhook payload twice**

```bash
# First call
curl -s -X POST http://localhost:3001/api/webhooks/receive \
  -H "Content-Type: application/json" \
  -H "x-webhook-source: test-gateway" \
  -d '{
    "event_type": "payment.completed",
    "transaction_id": "txn-test-001",
    "order_id": "d0000000-0000-0000-0000-000000000001",
    "tenant_id": "a0000000-0000-0000-0000-000000000001",
    "amount_cents": 9900,
    "currency": "USD",
    "timestamp": "2026-07-05T12:00:00Z"
  }' | jq
```

Expected: `{ "status": "processed" }` (or `"failed"` if the order is already in a terminal state).

```bash
# Second call (same payload)
curl -s -X POST http://localhost:3001/api/webhooks/receive \
  -H "Content-Type: application/json" \
  -H "x-webhook-source: test-gateway" \
  -d '{
    "event_type": "payment.completed",
    "transaction_id": "txn-test-001",
    "order_id": "d0000000-0000-0000-0000-000000000001",
    "tenant_id": "a0000000-0000-0000-0000-000000000001",
    "amount_cents": 9900,
    "currency": "USD",
    "timestamp": "2026-07-05T12:00:00Z"
  }' | jq
```

Expected: `{ "status": "duplicate" }`.

**Why this works:** The `webhook_events` table has a `UNIQUE` constraint on `idempotency_key`. The first `INSERT` succeeds. The second hits a `23505` unique violation, caught by the backend, which returns `"duplicate"` without processing.

## Test Ledger Integrity

```bash
curl -s http://localhost:3001/api/ledger/integrity \
  -H "x-tenant-id: a0000000-0000-0000-0000-000000000001" | jq
```

Expected:

```json
{
  "isValid": true,
  "errors": [],
  "stats": {
    "total_entries": 2,
    "total_orders_with_entries": 1,
    "total_credits": 1,
    "total_debits": 1
  }
}
```

**What each check verifies:**

| Check | What it does |
|-------|-------------|
| `mismatched_entries` | Every order should have exactly 2 ledger entries. Orders with 0, 1, or 3+ entries indicate a bug in the split payment logic. |
| `amount_mismatch` | `credit_sum + debit_sum` must equal the order's `total_cents`. A mismatch means the 90/10 split arithmetic is wrong. |
| `orphaned_entries` | Ledger entries referencing a non-existent order (foreign key violation). |
| `double_count_detected` | Checks that the combined credit + debit sums match the expected total, catching accidental duplicate entries. |

## Test Balance Calculation

```bash
# Current balance
curl -s http://localhost:3001/api/balance \
  -H "x-tenant-id: a0000000-0000-0000-0000-000000000001" | jq
```

Expected:

```json
{
  "total_credits": "8910",
  "total_debits": "990",
  "net_balance": "7920",
  "currency": "USD"
}
```

The `net_balance` equals `total_credits - total_debits`. There is no cached balance column — this is computed from a `SUM` query every time, so it is always correct.

```bash
# Balance history (last 30 days)
curl -s http://localhost:3001/api/balance/history \
  -H "x-tenant-id: a0000000-0000-0000-0000-000000000001" | jq
```

Returns daily credit/debit breakdown for the last 30 days.

## API Reference

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Backend health check |
| `GET` | `/api/resources` | List all resources for tenant |
| `GET` | `/api/resources/:id` | Get a single resource |
| `POST` | `/api/resources` | Create a resource |
| `PATCH` | `/api/resources/:id` | Update a resource |
| `DELETE` | `/api/resources/:id` | Soft-delete a resource (sets `is_active = false`) |
| `GET` | `/api/resources/:resourceId/variants` | List variants for a resource |
| `GET` | `/api/resources/:resourceId/variants/:id` | Get a single variant |
| `POST` | `/api/resources/:resourceId/variants` | Create a variant |
| `PATCH` | `/api/resources/:resourceId/variants/:id` | Update a variant |
| `DELETE` | `/api/resources/:resourceId/variants/:id` | Delete a variant |
| `GET` | `/api/orders` | List all orders for tenant |
| `GET` | `/api/orders/:id` | Get an order with its transition history |
| `POST` | `/api/orders` | Create an order (starts as `draft`) |
| `POST` | `/api/orders/:id/transition` | Transition an order to a new status |
| `GET` | `/api/ledger` | List ledger entries (paginated) |
| `GET` | `/api/ledger/entries/:orderId` | Get ledger entries for a specific order |
| `GET` | `/api/ledger/summary` | Get credit/debit totals |
| `GET` | `/api/ledger/integrity` | Run integrity validation |
| `GET` | `/api/balance` | Get current balance (credits, debits, net) |
| `GET` | `/api/balance/history` | Get daily balance breakdown (last 30 days) |
| `GET` | `/api/webhooks` | List recent webhook events |
| `GET` | `/api/webhooks/:id` | Get a specific webhook event |
| `POST` | `/api/webhooks/receive` | Receive a webhook from a payment gateway |

All endpoints except `/health` and `POST /api/webhooks/receive` require the `x-tenant-id` header.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Ledgr Platform                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────┐    ┌──────────────────┐    ┌───────────────┐  │
│  │  Web :3000    │───▶│  Backend :3001   │───▶│  Postgres :5432│  │
│  │  Next.js 15   │    │  Fastify          │    │  RLS enforced  │  │
│  │  App Router   │    │  tenant isolation │    │  7 tables      │  │
│  └──────────────┘    └────────┬─────────┘    └───────────────┘  │
│                               │                                   │
│  ┌───────────────────┐        │  pub/sub                         │
│  │ Payment Mock :3002│        ▼                                   │
│  │ POST /charge      │   ┌──────────┐                            │
│  │   │               │   │ Redis    │                            │
│  │   └─webhook──────▶│   │ :6379   │                            │
│  │                   │   └──────────┘                            │
│  └───────────────────┘                                           │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘

Request flow:
  Client ──▶ Web (:3000) ──▶ Backend (:3001) ──▶ Postgres (:5432)
                                      ▲
  Payment Mock (:3002) ──webhook───┘
  Payment Mock (:3002) ──pub/sub──▶ Redis (:6379) ──▶ Backend (:3001)
```

## Seed Data

After running `pnpm seed`, the database contains:

| Entity | Name | ID |
|--------|------|----|
| Tenant | Acme Corp | `a0000000-0000-0000-0000-000000000001` |
| Tenant | Globex Inc | `a0000000-0000-0000-0000-000000000002` |
| Tenant | Initech | `a0000000-0000-0000-0000-000000000003` |
| Variant | Basic Plan | `c0000000-0000-0000-0000-000000000001` ($29.00) |
| Variant | Pro Plan | `c0000000-0000-0000-0000-000000000002` ($99.00) |
| Variant | Single Domain SSL | `c0000000-0000-0000-0000-000000000003` ($4.99) |
| Variant | Consulting Standard | `c0000000-0000-0000-0000-000000000004` ($150.00) |
| Variant | Consulting Premium | `c0000000-0000-0000-0000-000000000005` ($250.00) |
| Variant | Annual License | `c0000000-0000-0000-0000-000000000006` ($499.00) |
| Order | Acme Pro Plan (paid) | `d0000000-0000-0000-0000-000000000001` |
| Order | Acme Basic Plan (draft) | `d0000000-0000-0000-0000-000000000002` |
| Order | Globex Consulting (pending_payment) | `d0000000-0000-0000-0000-000000000003` |
