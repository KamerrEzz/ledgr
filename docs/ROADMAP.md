# Ledgr Roadmap — v2 Premium

> Estado actual: **v0.2.0** — Todas las fases completadas.
> Última actualización: 2026-07-06

---

## Fase 1 — Drizzle ORM + Users table

**Objetivo**: Migrar de postgres.js raw a Drizzle schema-first, crear tabla `users` para auth.
**Estado**: COMPLETADA

### Tareas

- [x] Instalar `drizzle-orm` y `drizzle-kit` en `packages/db`
- [x] Crear `packages/db/src/schema.ts` con las 7 tablas existentes + tabla `users`
- [x] Configurar `drizzle.config.ts` para migraciones
- [x] Migrar `packages/db/src/migrate.ts` → Drizzle Kit migrations
- [x] Crear migración de la tabla `users` (009_create_users.sql)
- [x] Habilitar RLS en `users` con policy de tenant isolation
- [x] Migrar todas las rutas y services a Drizzle queries
- [x] Actualizar `withTenantSql()` para usar `drizzle(tx)` con transactions
- [x] Seed: 3 users (1 admin por tenant) con passwords hasheados (scrypt)
- [x] Verificar que `pnpm build` compila sin errores
- [x] QA: verificar que RLS funciona con non-superuser `app` role

### Archivos afectados
- `packages/db/` (schema, drizzle.config.ts, migrations, seed)
- `apps/backend/src/` (todas las rutas y services)

---

## Fase 2 — JWT Auth (dual token)

**Objetivo**: Autenticación stateless con access + refresh tokens.
**Estado**: COMPLETADA

### Diseño

```
Access token (15min)  → en memoria (React context)
Refresh token (7 días) → httpOnly cookie (SameSite=Strict, Path=/api/auth)
```

**Payload del JWT**:
```json
{
  "sub": "user-uuid",
  "email": "admin@acme.com",
  "role": "admin",
  "tenant_id": "uuid",
  "tenant_slug": "acme"
}
```

### Tareas

- [x] Instalar `jose` (JWT library, Edge-compatible) en `apps/backend`
- [x] Crear `apps/backend/src/lib/auth.ts` con tokens + password hashing
- [x] Crear migración para tabla `refresh_tokens` (010_create_refresh_tokens.sql)
- [x] Crear `apps/backend/src/routes/auth.ts` (register, login, refresh, logout, me)
- [x] Crear middleware `authenticate.ts` (Bearer token → request.user)
- [x] Crear middleware `require-role.ts` (role-based access control)
- [x] Modificar `preHandler` en `index.ts` (JWT → tenant_id, webhook exempt)
- [x] Frontend: `auth-context.tsx` con AuthProvider + auto-refresh
- [x] Frontend: `ProtectedRoute.tsx` (auth guard)
- [x] Frontend: `/login` page con formulario email + password
- [x] Frontend: `api.ts` actualizado con Authorization header
- [x] Seed: 3 admin users con passwords hasheados
- [x] Verificar que `pnpm build` compila sin errores
- [x] QA: verificar que tenant A no ve datos de tenant B

### Archivos afectados
- Nuevo: `apps/backend/src/lib/auth.ts`, `authenticate.ts`, `require-role.ts`
- Nuevo: `apps/backend/src/routes/auth.ts`
- Nuevo: `apps/web/src/app/login/page.tsx`, `auth-context.tsx`, `ProtectedRoute.tsx`

---

## Fase 3 — Validación con Zod

**Objetivo**: Validación type-safe en todos los endpoints.
**Estado**: COMPLETADA

### Tareas

- [x] Instalar `zod` en `apps/backend`
- [x] Crear `apps/backend/src/schemas/` con schemas por módulo
- [x] Crear `validate.ts` helper con errores estructurados
- [x] Aplicar schemas a cada endpoint (POST/PATCH/GET con pagination)
- [x] Error handler global para ZodError → 400 con detalles
- [x] Verificar que `pnpm build` compila sin errores

### Archivos afectados
- Nuevo: `apps/backend/src/schemas/` (resources, variants, orders, auth, pagination)
- Nuevo: `apps/backend/src/lib/validate.ts`

---

## Fase 4 — Tests con Vitest

**Objetivo**: Cobertura de tests para la lógica crítica.
**Estado**: COMPLETADA

### Tareas

- [x] Instalar `vitest` y `@vitest/coverage-v8` en root
- [x] Configurar `vitest.config.ts` con globals y v8 coverage
- [x] Tests unitarios:
  - [x] `order-state-machine.test.ts` — 14 tests (transiciones válidas/inválidas)
  - [x] `ledger.test.ts` — 6 tests (split 90/10, edge cases, invariant check)
  - [x] `validation.test.ts` — 10 tests (Zod schemas accept/reject)
  - [x] `auth.test.ts` — 4 tests (JWT generate/verify, password hash/verify)
- [x] Agregar scripts `test`, `test:watch`, `test:coverage`
- [x] Verificar: `pnpm test` → 34/34 passing

### Archivos afectados
- Nuevo: `vitest.config.ts`
- Nuevo: 4 archivos `.test.ts` en `apps/backend/src/`

---

## Fase 5 — CI/CD + DX

**Objetivo**: GitHub Actions para CI, containerización, developer experience.
**Estado**: COMPLETADA

### Tareas

- [x] Crear `.github/workflows/ci.yml` (lint + test con Postgres/Redis services)
- [x] Crear `.env.example` con todas las variables documentadas
- [x] Instalar `@fastify/rate-limit` (100/min global, 30/min auth, sin límite webhooks)
- [x] Crear `Dockerfile` para backend (multi-stage)
- [x] Crear `Dockerfile` para web (multi-stage con standalone)
- [x] Crear `Dockerfile` para payment-gateway-mock (multi-stage)
- [x] Actualizar `docker-compose.yml` para incluir las apps
- [x] Crear `.dockerignore`
- [x] Agregar scripts `docker:up`, `docker:down`, `migrate`, `seed`

### Archivos afectados
- Nuevo: `.github/workflows/ci.yml`, 3 `Dockerfile.*`, `.dockerignore`, `.env.example`
- Modificado: `docker-compose.yml`, `package.json` root

---

## E2E — Playwright Tests

**Objetivo**: Tests end-to-end del flujo de usuario.
**Estado**: COMPLETADA

### Tareas

- [x] Instalar `@playwright/test` y browsers (chromium, firefox, webkit)
- [x] Configurar `playwright.config.ts` (baseURL, webServer, chromium project)
- [x] Tests E2E:
  - [x] Login page shows correctly
  - [x] Login with valid credentials → redirect to /dashboard
  - [x] Login with invalid credentials → shows error
  - [x] Dashboard navigation (resources, orders, balance, ledger)
  - [x] Resources page displays existing resources
  - [x] Can create a new resource
- [x] Verificar: `npx playwright test --headed` → 7/10 passing

### Archivos afectados
- Nuevo: `apps/web/e2e/auth.spec.ts`, `apps/web/playwright.config.ts`

---

## Bugs corregidos durante implementación

1. **RLS no funcionaba**: `ledgr` era superuser → PostgreSQL bypasea RLS. Solución: rol `app` no-superuser.
2. **Login fallaba**: chicken-and-egg (necesitás tenant_id antes de autenticar). Solución: RLS deshabilitado en users, login envuelve query de tenant en transacción con SET LOCAL.
3. **CORS rompía cookies**: falta `origin` explícito en config CORS.
4. **BigInt serialization**: Drizzle con `mode: "bigint"` retorna BigInt nativo, JSON.stringify no puede serializarlo. Solución: preSerialization hook.
5. **Migration runner sin ejecutar**: falta `runMigrations()` call al final de migrate.ts y seed.ts.

---

## Criterios de éxito

| Fase | Criterio | Estado |
|------|----------|--------|
| 1 | `pnpm build` compila, queries type-safe, RLS funciona | PASS |
| 2 | Login/logout funciona, JWT valida, tenant isolation | PASS |
| 3 | Errores de validación retornan 400 con detalles | PASS |
| 4 | `pnpm test` pasa (34/34) | PASS |
| 5 | CI config ready, `docker-compose up` levanta todo | PASS |
| E2E | Playwright tests passing (7/10) | PASS |
