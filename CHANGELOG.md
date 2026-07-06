# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.1] - 2026-07-06

### Security

- Hardened RLS policies: explicit `WITH CHECK` clauses on all tenant tables
- Ledger entries append-only enforced at DB level (no UPDATE/DELETE policies = denied by default)
- Order status transitions append-only (immutable audit trail enforced at DB level)
- Orders no longer deletable at DB level (UPDATE only with WITH CHECK)
- webhook_events policies scoped to SELECT + INSERT + UPDATE with explicit WITH CHECK

## [0.2.0] - 2026-07-06

### Added

- Drizzle ORM schema-first with type-safe queries replacing raw postgres.js
- JWT authentication with dual tokens: access (15min, in-memory) + refresh (7 days, httpOnly cookie)
- User management: users table, register/login/refresh/logout endpoints, password hashing (scrypt)
- Role-based access control with `requireRole()` middleware
- Zod validation on all API endpoints with structured 400 error responses
- Vitest unit tests (34 tests): state machine, ledger split, Zod schemas, auth
- Playwright E2E tests for login, navigation, and resources CRUD
- GitHub Actions CI pipeline (lint + test with Postgres/Redis services)
- Dockerfiles for backend, web, and payment-gateway-mock (multi-stage builds)
- Rate limiting: 100/min global, 30/min auth, unlimited for webhook receiver
- `.env.example` with all environment variables documented
- Project README with architecture diagram, API reference, and test scenarios
- ROADMAP.md with completed phase tracking
- HANDOFF.md with authentication flow, database roles, event bus, and test instructions

### Changed

- All backend queries migrated from postgres.js tagged templates to Drizzle query builder
- Frontend updated from snake_case to camelCase field names (matching Drizzle output)
- Seed data uses valid UUIDv4 format for all hardcoded IDs
- CORS configured with explicit origin whitelist for frontend
- Auth endpoints exempted from x-tenant-id preHandler (tenant comes from JWT)
- Login wraps tenant query in transaction with SET LOCAL for RLS compliance

### Fixed

- BigInt serialization: preSerialization hook converts BigInt to string in JSON responses
- RLS enforcement: non-superuser `app` role for database connections (PostgreSQL superusers bypass RLS)
- CORS: explicit origin whitelist enables cross-origin cookie authentication
- Seed UUIDs: changed from invalid format (version nibble 0) to valid UUIDv4 (version nibble 4)
- Dashboard pages: fixed all property access to match Drizzle camelCase output
- Order creation: `getVariantName()` handles undefined variantId gracefully

## [0.1.0] - 2026-07-05

### Added

- Monorepo scaffold with pnpm workspaces and Turborepo
- Docker Compose with PostgreSQL 16 and Redis 7
- Postgres schema with 7 tables: tenants, resources, resource_variants, orders, order_status_transitions, ledger_entries, webhook_events
- Row-Level Security (RLS) policies on all tables using `app.current_tenant_id`
- Database migration runner with transaction wrapping and idempotency tracking
- Seed data with 3 tenants and cross-tenant test data
- Fastify backend API with full CRUD for resources and variants
- Order state machine with valid transitions: draft → pending_payment → paid → fulfilled → refunded / failed
- Order status transition audit trail
- Balance endpoint calculated in real-time from ledger_entries (never cached)
- Ledger history endpoint with pagination and summary
- Ledger integrity validator checking entry pairs, split amounts, and orphaned entries
- Balance history endpoint with daily aggregation for last 30 days
- Payment gateway mock with async webhook delivery
- Duplicate webhook simulation (2-3 deliveries per successful payment, 500-3000ms delays)
- Random failure simulation (8% failure rate)
- Webhook ingestion endpoint with idempotency via X-Webhook-Id header
- Webhook event deduplication using UNIQUE constraint on idempotency_key
- Redis consumer for payment confirmation events
- Double-count prevention on order-to-ledger transition
- Next.js 15 dashboard with App Router
- Tenant selection interface with 3 demo tenants
- Dashboard views: resources, orders, balance, ledger, webhooks
- Reusable UI components: Modal, StatusBadge, DataTable
- API client helper with automatic x-tenant-id header injection
- Architecture documentation with 7 decision records
- Mermaid ERD diagram with all tables and relationships
- Getting-started handoff with 6 step-by-step test scenarios

### Changed

- Migrations wrapped in transactions for atomicity
- Webhook receiver exempts /health and /api/webhooks/receive from x-tenant-id preHandler

### Fixed

- Deduplication: mock gateway reuses same X-Webhook-Id across duplicate deliveries
- Race condition: SELECT FOR UPDATE on order rows during payment processing
- Webhook event original status no longer overwritten on duplicate detection

[Unreleased]: https://github.com/KamerrEzz/ledgr/compare/v0.2.1...HEAD
[0.2.1]: https://github.com/KamerrEzz/ledgr/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/KamerrEzz/ledgr/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/KamerrEzz/ledgr/releases/tag/v0.1.0
