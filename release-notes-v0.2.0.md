# v0.2.0 — Drizzle, JWT Auth, Validation, Tests, CI/CD

Ledgr v0.2.0 is a major quality upgrade — the entire database layer, authentication system, input validation, test infrastructure, and CI/CD pipeline have been built from the ground up.

## What's New

### Drizzle ORM (Type-Safe Database)
- Schema-first approach with TypeScript types generated automatically
- All 8 tables (7 original + users) defined in a single `schema.ts`
- Migrations via Drizzle Kit for safe, repeatable schema changes
- Replaces 46 raw SQL queries with typed query builder calls

### JWT Authentication
- Stateless dual-token pattern: access token (15min) + refresh token (7 days)
- Access token stored in React memory (XSS-safe)
- Refresh token in httpOnly cookie with SameSite=Strict
- JWT payload carries tenant_id, user_id, email, role, and tenant_slug
- Automatic token refresh before expiry

### Zod Validation
- Every API endpoint validates request body with type-safe Zod schemas
- Structured 400 error responses with field-level details
- Pagination parameters validated and coerced from query strings

### Test Infrastructure
- **34 unit tests** covering state machine, ledger math, schemas, and auth
- **Playwright E2E tests** for login flow, dashboard navigation, and resource creation
- All tests run against a real PostgreSQL database

### CI/CD Pipeline
- GitHub Actions with Postgres 16 and Redis 7 service containers
- Automated lint, build, and test on every push and PR
- Dockerfiles for all 3 apps (multi-stage, production-ready)

## Bug Fixes

- **BigInt serialization** — Drizzle's `mode: "bigint"` returns native BigInt which JSON.stringify cannot serialize. Added Fastify preSerialization hook to convert to string.
- **RLS not enforcing** — PostgreSQL superusers bypass RLS even with FORCE ROW LEVEL SECURITY. Created a non-superuser `app` role for application connections.
- **Invalid seed UUIDs** — Hardcoded seed IDs had version nibble 0 instead of 4, causing Zod `.uuid()` validation to reject order creation.

## Test Users

| Email | Password | Role | Tenant |
|-------|----------|------|--------|
| `admin@acme.com` | `password123` | admin | Acme Corp |
| `admin@globex.com` | `password123` | admin | Globex Inc |
| `admin@initech.com` | `password123` | admin | Initech |

## Quick Start

```bash
git clone https://github.com/KamerrEzz/ledgr.git && cd ledgr
pnpm install
docker compose up -d
cd packages/db && pnpm build && pnpm migrate && pnpm seed
cd ../.. && pnpm dev
```

Open http://localhost:3000 and log in with any test user.

## Run Tests

```bash
pnpm test                                    # 34 unit tests
cd apps/web && npx playwright test --headed  # E2E in browser
```
