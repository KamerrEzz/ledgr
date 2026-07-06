# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/KamerrEzz/ledgr/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/KamerrEzz/ledgr/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/KamerrEzz/ledgr/releases/tag/v0.1.0
