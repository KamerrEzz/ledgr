# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/OWNER/REPO/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/OWNER/REPO/releases/tag/v0.1.0
