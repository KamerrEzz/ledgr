# Ledgr Architecture

Ledgr is a multi-tenant SaaS marketplace boilerplate demonstrating how to build a production-grade platform with isolated tenant data, split payments, an append-only ledger, and an event-driven payment pipeline. It is built with TypeScript across a pnpm monorepo: a Fastify backend, a Next.js 15 frontend, a mock payment gateway, PostgreSQL 16 with Row-Level Security, and Redis for async messaging.

---

## Multi-Tenancy with RLS

### Why RLS over application-level filtering

Every multi-tenant system must answer one question: *where is the boundary between tenants?*

The naive approach puts `WHERE tenant_id = ?` in every query. This is fragile. A single forgotten filter leaks data across tenants. It scales with developer discipline — the exact thing that fails in production under pressure.

Row-Level Security (RLS) moves the boundary into PostgreSQL itself. The database enforces isolation per-connection. Even if application code forgets the `WHERE` clause, PostgreSQL silently returns zero rows. This is defense-in depth: the application *and* the database enforce the same rule.

### How `SET LOCAL app.current_tenant_id` works

When a request arrives, the backend extracts the tenant ID from the `x-tenant-id` header. It then opens a PostgreSQL transaction and runs:

```sql
SELECT set_config('app.current_tenant_id', '<tenant-uuid>', true)
```

The third argument (`true`) means "local to this transaction only." The setting is invisible to every other connection and expires when the transaction commits or rolls back. There is no global mutable state.

Each RLS policy on a table references this setting:

```sql
CREATE POLICY tenant_isolation_resources ON resources
  USING (tenant_id::text = current_setting('app.current_tenant_id'));
```

### The `withTenantSql()` pattern

The backend wraps every tenant-scoped database operation in `withTenantSql()`:

```typescript
withTenantSql(tenantId, async (tx) => {
  return tx`SELECT * FROM resources`;
});
```

This function opens a transaction, sets the tenant context, executes the callback, and commits. The caller never touches the RLS configuration — it is invisible boilerplate that happens exactly once per request.

### Why this is more secure than WHERE filtering

- A forgotten `WHERE tenant_id = ?` returns empty results instead of leaking data.
- The RLS policy is defined once per table and cannot be bypassed by application code.
- Transaction-local settings mean no connection leaks tenant context.
- Even a SQL injection vulnerability in one query cannot access another tenant's rows — the RLS policy still applies.

---

## Monorepo Structure

### Why pnpm workspaces + Turborepo

pnpm workspaces provide dependency hoisting and workspace protocol linking (`workspace:*`). Turborepo adds task orchestration with caching and dependency ordering. Together they give you:

- **Single `pnpm install`** for all packages.
- **`turbo dev`** starts all apps in parallel with hot-reload.
- **`turbo build`** respects the dependency graph — packages build before apps.
- **Incremental builds** — only changed packages rebuild.

### apps/ vs packages/

```
apps/
  backend/              → Fastify API server (port 3001)
  web/                  → Next.js 15 frontend (port 3000)
  payment-gateway-mock/ → Stripe-like mock (port 3002)

packages/
  db/                   → Migrations, seeds, postgres.js client
  shared-types/         → TypeScript interfaces shared across apps
  event-bus/            → Redis pub/sub publisher and subscriber
```

`apps/` contains deployable services. `packages/` contains shared libraries consumed by apps. Apps can import packages via `@ledgr/db`, `@ledgr/event-bus`, or `@ledgr/shared-types`. Packages never import apps.

### Dependency graph

```
web ────────→ shared-types
backend ───→ db
         ──→ event-bus
         ──→ shared-types
```

Turborepo reads this graph from `package.json` dependencies and builds packages before apps that depend on them.

---

## Ledger Design

### Why append-only (no UPDATE/DELETE)

A financial ledger must be an immutable record of what happened. UPDATE and DELETE destroy evidence. If a bug creates a wrong entry, you don't delete it — you create an opposite entry (a correction). This is standard accounting practice.

The schema enforces this structurally: `ledger_entries` has no soft-delete column and no UPDATE route. INSERT-only writes are also faster because PostgreSQL can skip row-locking overhead.

### Split payment pattern (90/10)

When an order transitions to `paid`, the ledger creates two entries:

| entry_type | Description | Amount |
|------------|-------------|--------|
| credit | Tenant payout | 90% of total |
| debit | Platform commission | 10% of total |

The split is deterministic: `platformCommission = (totalCents * 10n) / 100n`. Using `BigInt` arithmetic ensures no floating-point rounding. A 9900-cent order produces exactly 8910 credit + 990 debit = 9900 total.

### Balance calculated from SUM, never cached

The balance endpoint computes `SUM(credits) - SUM(debits)` on every request. There is no `balance` column that could drift from reality. This is a deliberate tradeoff: the query is slightly more expensive, but the balance is always correct and never stale.

### Integrity validation

The `/api/ledger/integrity` endpoint runs four checks:

1. **Mismatched entries** — Every order should have exactly 2 ledger entries (credit + debit). Orders with 0, 1, or 3+ entries indicate a bug.
2. **Amount mismatch** — `credit_sum + debit_sum` must equal the order's `total_cents`. A mismatch means the split calculation is wrong.
3. **Orphaned entries** — Ledger entries referencing a non-existent order. Should never happen if foreign keys are enforced.
4. **Double-count detection** — Checks that credit + debit sums match the expected total, catching any accidental duplicate entries.

---

## Order State Machine

### Why a state machine instead of a status field

A `status` column with no transition rules lets orders jump from `draft` to `refunded` in one step. That is a bug waiting to happen. A state machine defines which transitions are legal and rejects the rest with a 400 error.

### Valid transitions

```
draft            → pending_payment
pending_payment  → paid, failed
paid             → fulfilled
fulfilled        → refunded
failed           → (terminal)
refunded         → (terminal)
```

`failed` and `refunded` are terminal states with no outgoing transitions. You cannot unfail or unrefund an order.

### Why transitions are logged in a separate table

`order_status_transitions` records every state change with `from_status`, `to_status`, `reason`, and a timestamp. This is an audit trail. If an order shows an unexpected state, you can read the transition history to understand what happened and when. The `orders.status` column alone does not tell you this.

---

## Webhook Idempotency

### Why webhooks arrive multiple times

Real payment gateways (Stripe, PayPal, Square) send webhooks with at-least-once delivery. Network timeouts cause retries. A gateway that doesn't get a `200 OK` within 3 seconds will resend the same webhook. The payment mock simulates this intentionally — it sends the same payload 2-4 times.

### Hash-based deduplication pattern

Every webhook carries an `X-Webhook-Id` header. If the header is present, it is used as the idempotency key. If absent, a SHA-256 hash of the request body is used.

```typescript
const idempotencyKey =
  typeof webhookIdHeader === "string" && webhookIdHeader
    ? webhookIdHeader
    : createHash("sha256")
        .update(JSON.stringify(body))
        .digest("hex");
```

The key is stored with a `UNIQUE` constraint in `webhook_events`. The first insert succeeds; subsequent inserts hit a `UNIQUE` violation (PostgreSQL error code `23505`) and return `{ status: "duplicate" }` without processing.

### The webhook_events table design

| Column | Purpose |
|--------|---------|
| source | Which gateway sent this (e.g., `payment-gateway-mock`) |
| event_type | What happened (`payment.completed`, `payment.failed`) |
| payload | Full JSON body for debugging |
| idempotency_key | Deduplication key with UNIQUE constraint |
| status | Lifecycle: `received` → `processing` → `processed` / `failed` |
| processed_at | When processing completed (nullable) |
| error_message | Failure details (nullable) |

The status field tracks the processing lifecycle. If a webhook fails, the error is recorded and the status stays `failed`. This makes debugging webhook issues straightforward.

---

## Event-Driven Architecture

### Redis pub/sub for payment confirmations

The payment gateway mock sends webhooks via HTTP. The backend processes them synchronously. But the backend also has a Redis consumer that listens for `payment:confirmed` events. This is an alternative path — useful when the payment system publishes events directly instead of calling webhooks.

### Why async communication between gateway and backend

Synchronous HTTP calls block both sides. If the backend is slow, the gateway times out. If the gateway is down, the backend waits. Pub/sub decouples the two: the gateway publishes an event and moves on. The backend processes it when ready.

Redis pub/sub is not durable (messages are lost if no subscriber is connected), which is fine for this boilerplate. A production system would use Redis Streams or a dedicated message broker.

### Consumer pattern

The consumer subscribes to `payment:confirmed` on startup:

```typescript
subscriber.subscribe("payment:confirmed");
subscriber.on("message", async (channel, message) => {
  // validate, transition order, create ledger entries
});
```

Each message is parsed, validated, and processed inside a transaction with RLS context. Invalid transitions are logged and skipped. The consumer is fault-tolerant — a single bad message does not crash the process.

---

## Technology Choices

### postgres.js over ORM

An ORM abstracts SQL behind a query builder. This hides what the database actually does. For a project where RLS is a core security mechanism, hiding SQL is dangerous — you cannot audit what you cannot see.

postgres.js gives you tagged template literals that look like SQL because they *are* SQL. Every query is visible, auditable, and easy to reason about. The `sql.begin()` transaction API integrates naturally with `SET LOCAL` for RLS context.

### Fastify over Express

Fastify is 2-3x faster than Express for JSON workloads due to its schema-based serialization. It also provides built-in request validation via JSON Schema, which Express requires third-party middleware for. For an API server handling financial transactions, these are meaningful advantages.

### Next.js App Router

The frontend uses Next.js 15 with App Router for React Server Components (RSC). RSCs render on the server and send minimal HTML to the client, reducing JavaScript bundle size. Client components handle interactivity. Tailwind CSS v4 provides utility styling without runtime overhead.

### BigInt for money

Floating-point arithmetic produces errors like `0.1 + 0.2 = 0.30000000000000004`. Financial systems store money as integers (cents) and use `BigInt` to avoid overflow. A 9900-cent order is `9900n`, not `99.00`. The `CHECK (price_cents >= 0)` constraint ensures no negative prices slip through.
