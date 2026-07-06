# Ledgr — Getting Started

## Prerequisites

- **Node.js** 20 or later
- **pnpm** 9.x (the repo specifies `packageManager: pnpm@9.15.4`)
- **Docker** and **Docker Compose** (for PostgreSQL and Redis)

## Quick Start

```bash
# 1. Clone and install
git clone https://github.com/KamerrEzz/ledgr.git
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

> **Note:** The backend now uses a non-superuser `app` role for database connections (RLS enforcement). Migrations and seeds run as the `ledgr` superuser. See [Database Roles](#database-roles) for details.

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

## Authentication

Ledgr uses stateless JWT authentication with dual tokens:

- **Access token** (15min): stored in React memory, sent via `Authorization: Bearer` header
- **Refresh token** (7 days): stored in httpOnly cookie (`SameSite=Strict`, `Path=/api/auth`)

### Test Users

| Email | Password | Role | Tenant |
|-------|----------|------|--------|
| `admin@acme.com` | `password123` | admin | Acme Corp |
| `admin@globex.com` | `password123` | admin | Globex Inc |
| `admin@initech.com` | `password123` | admin | Initech |

### Login

```bash
# Get access token
curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@acme.com", "password": "password123"}' | jq
```

Save the `access_token` from the response. Use it in all subsequent requests:

```bash
TOKEN="<access_token>"

# Access protected resources
curl -s http://localhost:3001/api/resources \
  -H "Authorization: Bearer $TOKEN" | jq
```

### Refresh Token

The refresh token is automatically sent as an httpOnly cookie. To get a new access token:

```bash
curl -s -X POST http://localhost:3001/api/auth/refresh \
  -b "refresh_token=<token>" | jq
```

### Logout

```bash
curl -s -X POST http://localhost:3001/api/auth/logout \
  -b "refresh_token=<token>" | jq
```

## Test Multi-Tenant Isolation

This test proves that RLS prevents Tenant B from seeing Tenant A's data.

**Step 1: Login as Acme admin**

```bash
ACME_TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@acme.com", "password": "password123"}' | jq -r '.access_token')
```

**Step 2: Create a resource as Tenant A (Acme)**

```bash
curl -s -X POST http://localhost:3001/api/resources \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACME_TOKEN" \
  -d '{"name": "Test Product", "description": "Created by Acme"}' | jq
```

Save the `id` from the response.

**Step 3: Login as Globex admin and try to read Acme's resource**

```bash
GLOBEX_TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@globex.com", "password": "password123"}' | jq -r '.access_token')

curl -s http://localhost:3001/api/resources/<resource-id> \
  -H "Authorization: Bearer $GLOBEX_TOKEN" | jq
```

Expected response: `404` — `"Resource not found"`. The resource exists, but RLS hides it from Globex.

**Step 4: Read it as Tenant A (Acme)**

```bash
curl -s http://localhost:3001/api/resources/<resource-id> \
  -H "Authorization: Bearer $ACME_TOKEN" | jq
```

Expected response: the full resource object with `name: "Test Product"`.

**Why this works:** PostgreSQL RLS filters rows based on `app.current_tenant_id`. The JWT token contains the `tenant_id`, which is set via `SET LOCAL` in the database transaction. The query `SELECT * FROM resources WHERE id = <id>` returns a row for Acme but returns nothing for Globex because Globex's `tenant_id` does not match Acme's UUID. The database enforces this — not the application.

## Test Order State Machine

**Step 1: Create an order (status: draft)**

```bash
curl -s -X POST http://localhost:3001/api/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACME_TOKEN" \
  -d '{"resource_variant_id": "c0000000-0000-0000-0000-000000000001", "quantity": 2}' | jq
```

The response shows `"status": "draft"`. Save the `id`.

**Step 2: Try to transition directly to 'fulfilled' — should fail**

```bash
curl -s -X POST http://localhost:3001/api/orders/<order-id>/transition \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACME_TOKEN" \
  -d '{"to_status": "fulfilled"}' | jq
```

Expected: `400` — `"Invalid transition from 'draft' to 'fulfilled'"`. The state machine rejects illegal jumps.

**Step 3: Transition draft → pending_payment → paid — should succeed**

```bash
# draft → pending_payment
curl -s -X POST http://localhost:3001/api/orders/<order-id>/transition \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACME_TOKEN" \
  -d '{"to_status": "pending_payment", "reason": "Customer submitted order"}' | jq

# pending_payment → paid
curl -s -X POST http://localhost:3001/api/orders/<order-id>/transition \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACME_TOKEN" \
  -d '{"to_status": "paid", "reason": "Payment confirmed"}' | jq
```

Both return `200` with the updated order.

**Step 4: Check ledger entries**

```bash
curl -s http://localhost:3001/api/ledger/entries/<order-id> \
  -H "Authorization: Bearer $ACME_TOKEN" | jq
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
  -H "Authorization: Bearer $ACME_TOKEN" | jq
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
  -H "Authorization: Bearer $ACME_TOKEN" | jq
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
  -H "Authorization: Bearer $ACME_TOKEN" | jq
```

Returns daily credit/debit breakdown for the last 30 days.

## API Reference

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/health` | Backend health check | No |
| `POST` | `/api/auth/register` | Register a new user | Admin |
| `POST` | `/api/auth/login` | Login and get access token | No |
| `POST` | `/api/auth/refresh` | Refresh access token | Cookie |
| `POST` | `/api/auth/logout` | Logout and clear refresh token | No |
| `GET` | `/api/auth/me` | Get current user from JWT | Yes |
| `GET` | `/api/resources` | List all resources for tenant | Yes |
| `GET` | `/api/resources/:id` | Get a single resource | Yes |
| `POST` | `/api/resources` | Create a resource | Yes |
| `PATCH` | `/api/resources/:id` | Update a resource | Yes |
| `DELETE` | `/api/resources/:id` | Soft-delete a resource (sets `is_active = false`) | Yes |
| `GET` | `/api/resources/:resourceId/variants` | List variants for a resource | Yes |
| `GET` | `/api/resources/:resourceId/variants/:id` | Get a single variant | Yes |
| `POST` | `/api/resources/:resourceId/variants` | Create a variant | Yes |
| `PATCH` | `/api/resources/:resourceId/variants/:id` | Update a variant | Yes |
| `DELETE` | `/api/resources/:resourceId/variants/:id` | Delete a variant | Yes |
| `GET` | `/api/orders` | List all orders for tenant | Yes |
| `GET` | `/api/orders/:id` | Get an order with its transition history | Yes |
| `POST` | `/api/orders` | Create an order (starts as `draft`) | Yes |
| `POST` | `/api/orders/:id/transition` | Transition an order to a new status | Yes |
| `GET` | `/api/ledger` | List ledger entries (paginated) | Yes |
| `GET` | `/api/ledger/entries/:orderId` | Get ledger entries for a specific order | Yes |
| `GET` | `/api/ledger/summary` | Get credit/debit totals | Yes |
| `GET` | `/api/ledger/integrity` | Run integrity validation | Yes |
| `GET` | `/api/balance` | Get current balance (credits, debits, net) | Yes |
| `GET` | `/api/balance/history` | Get daily balance breakdown (last 30 days) | Yes |
| `GET` | `/api/webhooks` | List recent webhook events | Yes |
| `GET` | `/api/webhooks/:id` | Get a specific webhook event | Yes |
| `POST` | `/api/webhooks/receive` | Receive a webhook from a payment gateway | No |

**Auth column:**
- **No**: No authentication required
- **Yes**: Requires `Authorization: Bearer <token>` header (JWT)
- **Admin**: Requires admin role (via JWT)
- **Cookie**: Uses httpOnly refresh token cookie

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

## Database Roles

Ledgr uses two PostgreSQL roles for security:

| Role | Purpose | Used By |
|------|---------|---------|
| `ledgr` | Superuser — runs migrations and seeds | `pnpm migrate`, `pnpm seed` |
| `app` | Non-superuser — application queries with RLS enforced | Backend API |

**Why two roles?** PostgreSQL superusers bypass Row-Level Security even when `FORCE ROW LEVEL SECURITY` is set. The `ledgr` role needs superuser privileges for migrations (creating tables, enabling RLS). The `app` role connects as a normal user, so RLS policies actually filter rows.

**Connection strings:**
- Application: `postgres://app:ledgr_app@localhost:5432/ledgr` (set in `DATABASE_URL`)
- Admin: `postgres://ledgr:ledgr_dev@localhost:5432/ledgr` (used by migrate/seed scripts)

## Event Bus (Redis Pub/Sub)

The `@ledgr/event-bus` package provides a thin wrapper around Redis for event-driven communication between services.

### Architecture

```
Payment Mock (:3002)  ──webhook──▶ Backend (:3001)
                        │
                        ├──pub/sub──▶ Redis (:6379)
                                        │
                        Backend (:3001) ◀┘
```

### How It Works

1. **Payment Mock** sends webhooks directly to the Backend's `POST /api/webhooks/receive` endpoint
2. The Backend processes the webhook and publishes a `payment:confirmed` event to Redis
3. The Backend's Redis consumer listens for `payment:confirmed` events and processes them (transitions order to paid, creates ledger entries)

### Package API

```typescript
import { createPublisher, createSubscriber, redis } from "@ledgr/event-bus";

// Create a publisher (for sending events)
const publisher = createPublisher();
await publisher.publish("payment:confirmed", JSON.stringify({ order_id, tenant_id }));

// Create a subscriber (for receiving events)
const subscriber = createSubscriber();
await subscriber.subscribe("payment:confirmed");
subscriber.on("message", (channel, message) => {
  console.log(`Received on ${channel}:`, JSON.parse(message));
});

// Direct Redis access (for advanced use cases)
await redis.set("key", "value");
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_HOST` | `localhost` | Redis server hostname |
| `REDIS_PORT` | `6379` | Redis server port |

### Event Channels

| Channel | Publisher | Consumer | Payload |
|---------|-----------|----------|---------|
| `payment:confirmed` | Backend (webhook handler) | Backend (payment consumer) | `{ order_id, tenant_id, status }` |

## Running Tests

### Unit Tests (Vitest)

```bash
# Run all unit tests
pnpm test

# Run with coverage
pnpm test:coverage

# Run in watch mode
pnpm test:watch
```

### E2E Tests (Playwright)

```bash
cd apps/web

# Run all E2E tests
npx playwright test

# Run in headed mode (visible browser)
npx playwright test --headed

# Run specific test
npx playwright test -g "login"
```

### Test Users for E2E

| Email | Password | Role | Tenant |
|-------|----------|------|--------|
| `admin@acme.com` | `password123` | admin | Acme Corp |
| `admin@globex.com` | `password123` | admin | Globex Inc |
| `admin@initech.com` | `password123` | admin | Initech |
