# Ledgr Roadmap — v2 Premium

> Estado actual: v0.1.0 released. Auth, validación, tests y CI/CD pendientes.
> Última actualización: 2026-07-05

---

## Fase 1 — Drizzle ORM + Users table

**Objetivo**: Migrar de postgres.js raw a Drizzle schema-first, crear tabla `users` para auth.
**Dependencias**: Ninguna (base para todo lo demás).
**Riesgo**: ALTO — toca toda la capa de persistencia.

### Tareas

- [ ] Instalar `drizzle-orm` y `drizzle-kit` en `packages/db`
- [ ] Crear `packages/db/src/schema.ts` con las 7 tablas existentes + tabla `users`
- [ ] Configurar `drizzle.config.ts` para migraciones
- [ ] Migrar `packages/db/src/migrate.ts` → Drizzle Kit migrations
- [ ] Crear migración de la tabla `users`:
  ```sql
  CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member', 'viewer')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(tenant_id, email)
  );
  ```
- [ ] Habilitar RLS en `users` con policy de tenant isolation
- [ ] Crear `packages/db/src/queries/` con queries tipadas por módulo (resources, orders, ledger, etc.)
- [ ] Migrar `apps/backend/src/routes/resources.ts` a Drizzle queries
- [ ] Migrar `apps/backend/src/routes/variants.ts` a Drizzle queries
- [ ] Migrar `apps/backend/src/routes/orders.ts` a Drizzle queries
- [ ] Migrar `apps/backend/src/routes/balance.ts` a Drizzle queries
- [ ] Migrar `apps/backend/src/routes/ledger.ts` a Drizzle queries
- [ ] Migrar `apps/backend/src/routes/webhooks.ts` a Drizzle queries
- [ ] Migrar `apps/backend/src/services/ledger.ts` a Drizzle queries
- [ ] Migrar `apps/backend/src/services/ledger-integrity.ts` a Drizzle queries
- [ ] Migrar `apps/backend/src/consumers/payment-confirmations.ts` a Drizzle queries
- [ ] Actualizar `withTenantSql()` para usar `drizzle(tx)` en vez de tagged templates
- [ ] Eliminar dependencia `postgres` de `packages/db` (_drizzle-orm lo reemplaza_)
- [ ] Seed: 3 users (1 admin por tenant) con passwords hasheados (bcrypt)
- [ ] Verificar que `pnpm build` compila sin errores
- [ ] QA: verificar que RLS sigue funcionando con las queries de Drizzle

### Archivos afectados
- `packages/db/` (schema, queries, migrate, seed)
- `apps/backend/src/` (todas las rutas y services)

---

## Fase 2 — JWT Auth (dual token)

**Objetivo**: Autenticación stateless con access + refresh tokens.
**Dependencias**: Fase 1 completada (tabla `users` existe).
**Riesgo**: MEDIO — agrega nueva funcionalidad sin romper existente.

### Diseño

```
Access token (15min)  → en memoria (React context)
Refresh token (7 días) → httpOnly cookie (SameSite=Strict, Path=/api/auth)
```

**Payload del JWT**:
```json
{
  "user_id": "uuid",
  "email": "admin@acme.com",
  "role": "admin",
  "tenant_id": "uuid",
  "tenant_slug": "acme"
}
```

### Tareas

- [ ] Instalar `jose` (JWT library, Edge-compatible) en `packages/shared-types` o nuevo `packages/auth`
- [ ] Crear `packages/auth/` con lógica compartida:
  - `src/tokens.ts` — generateAccessToken(), generateRefreshToken(), verifyAccessToken(), verifyRefreshToken()
  - `src/passwords.ts` — hashPassword(), verifyPassword() (usando Web Crypto API o bcrypt)
  - `src/constants.ts` — ACCESS_TOKEN_EXPIRY (15min), REFRESH_TOKEN_EXPIRY (7 días), ISSUER, AUDIENCE
- [ ] Crear migración para tabla `refresh_tokens`:
  ```sql
  CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
  CREATE INDEX idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
  ```
- [ ] Crear `apps/backend/src/routes/auth.ts`:
  - `POST /api/auth/register` — crear usuario (solo admin autenticado puede)
  - `POST /api/auth/login` — validar credentials, retornar access token + setear refresh cookie
  - `POST /api/auth/refresh` — validar refresh token de cookie, retornar nuevo access token
  - `POST /api/auth/logout` — eliminar refresh token + limpiar cookie
  - `GET /api/auth/me` — retornar usuario actual desde JWT
- [ ] Crear middleware `apps/backend/src/lib/authenticate.ts`:
  - Extraer Bearer token del header Authorization
  - Verificar JWT con jose
  - Inyectar payload del token en `request.user`
  - Retornar 401 si token inválido/expirado
- [ ] Crear middleware `apps/backend/src/lib/require-role.ts`:
  - Verificar que el usuario tiene el rol requerido
  - Retornar 403 si no tiene permisos
- [ ] Modificar `preHandler` en `index.ts`:
  - Si hay Bearer token → usar JWT para extraer tenant_id
  - Si no hay Bearer token → fallback a x-tenant-id header (para compatibilidad con webhook receiver)
  - `/api/webhooks/receive` sigue sin auth (external source)
- [ ] Proteger endpoints de escritura (POST/PATCH/DELETE) con `authenticate`
- [ ] Proteger `POST /api/auth/register` con `requireRole('admin')`
- [ ] Frontend: crear `apps/web/src/lib/auth-context.tsx`:
  - `AuthProvider` con estado: user, token, isAuthenticated
  - `login(email, password)` → llama POST /api/auth/login, almacena token en memory
  - `logout()` → llama POST /api/auth/logout, limpia estado
  - `refreshToken()` → llama POST /api/auth/refresh automáticamente antes de expirar
  - `useAuth()` hook
- [ ] Frontend: crear `apps/web/src/components/ProtectedRoute.tsx`:
  - Si no hay token → redirect a /login
  - Si hay token → render children
- [ ] Frontend: crear página `/login` con formulario de email + password
- [ ] Frontend: modificar tenant selection → ahora viene del JWT, no de un botón
- [ ] Frontend: actualizar api.ts para enviar Authorization header
- [ ] Seed: passwords hasheados para los 3 users de prueba
- [ ] Verificar que `pnpm build` compila sin errores
- [ ] QA: verificar que un usuario de Tenant A no puede acceder a datos de Tenant B

### Archivos afectados
- Nuevo: `packages/auth/`, `apps/backend/src/routes/auth.ts`, `apps/backend/src/lib/authenticate.ts`
- Nuevo: `apps/web/src/lib/auth-context.tsx`, `apps/web/src/components/ProtectedRoute.tsx`, `apps/web/src/app/login/page.tsx`
- Modificado: `apps/backend/src/index.ts`, todas las rutas (agregar authenticate middleware)

---

## Fase 3 — Validación con Zod

**Objetivo**: Validación type-safe en todos los endpoints.
**Dependencias**: Fase 1 y 2 completadas.
**Riesgo**: BAJO — solo agrega validación, no cambia lógica.

### Tareas

- [ ] Instalar `zod` y `@fastify/type-provider-zod` en `apps/backend`
- [ ] Crear `apps/backend/src/schemas/` con schemas por módulo:
  - `resources.ts` — createResourceSchema, updateResourceSchema
  - `variants.ts` — createVariantSchema, updateVariantSchema
  - `orders.ts` — createOrderSchema, transitionOrderSchema
  - `auth.ts` — registerSchema, loginSchema
  - `pagination.ts` — paginationSchema (page, limit)
- [ ] Integrar `@fastify/type-provider-zod` en el servidor Fastify
- [ ] Aplicar schemas a cada endpoint via `schema` option de Fastify
- [ ] Crear error handler estructurado para errores de validación:
  ```json
  {
    "error": "Validation failed",
    "details": [
      { "field": "name", "message": "Required", "code": "invalid_type" }
    ]
  }
  ```
- [ ] Compartir schemas con frontend para form validation
- [ ] Frontend: usar schemas de Zod en formularios (react-hook-form + zodResolver)
- [ ] Verificar que `pnpm build` compila sin errores

### Archivos afectados
- Nuevo: `apps/backend/src/schemas/` (todos los archivos)
- Modificado: todas las rutas (agregar validación)

---

## Fase 4 — Tests con Vitest

**Objetivo**: Cobertura de tests para la lógica crítica.
**Dependencias**: Fase 1, 2, 3 completadas.
**Riesgo**: BAJO — solo agrega tests, no cambia código de producción.

### Tareas

- [ ] Instalar `vitest` y `@vitest/coverage-v8` en root y packages relevantes
- [ ] Configurar `vitest.config.ts` en root con workspaces
- [ ] Crear test database setup (Docker o SQLite para tests rápidos)
- [ ] Tests unitarios:
  - `packages/auth/src/tokens.test.ts` — generar y verificar JWT
  - `packages/auth/src/passwords.test.ts` — hashear y verificar passwords
  - `apps/backend/src/services/order-state-machine.test.ts` — todas las transiciones válidas e inválidas
  - `apps/backend/src/services/ledger.test.ts` — cálculo de split payment (90/10)
- [ ] Tests de integración:
  - `apps/backend/src/__tests__/rls-isolation.test.ts` — crear resource como Tenant A, intentar leer como Tenant B → empty
  - `apps/backend/src/__tests__/webhook-dedup.test.ts` — enviar mismo webhook 2 veces → second es duplicate
  - `apps/backend/src/__tests__/auth-flow.test.ts` → register → login → access protected route → refresh → logout
  - `apps/backend/src/__tests__/order-lifecycle.test.ts` — crear orden → transicionar → verificar ledger entries
- [ ] Agregar script `test` a package.json root: `vitest`
- [ ] Agregar script `test:coverage` para coverage report
- [ ] Verificar que los tests pasan: `pnpm test`

### Archivos afectados
- Nuevo: `vitest.config.ts`, `apps/backend/src/__tests__/`, tests en packages

---

## Fase 5 — CI/CD + DX

**Objetivo**: GitHub Actions para CI, containerización, developer experience.
**Dependencias**: Fase 4 completada (tests existen para correr en CI).
**Riesgo**: BAJO — solo agrega infraestructura.

### Tareas

- [ ] Crear `.github/workflows/ci.yml`:
  - Trigger: push a main, pull requests
  - Jobs: lint → build → test (en paralelo donde sea posible)
  - Node 20, pnpm 9.x, Docker services (Postgres, Redis)
- [ ] Crear `.env.example` con todas las variables documentadas
- [ ] Instalar `@fastify/rate-limit` en backend:
  - Rate limit global: 100 requests/min por IP
  - Rate limit en auth endpoints: 10 requests/min por IP
  - Rate limit en webhook receiver: sin límite (external source)
- [ ] Configurar logging estructurado con Pino:
  - Request/response logging
  - Error logging con stack traces
  - Custom log levels para diferentes ambientes
- [ ] Crear `Dockerfile` para backend (multi-stage: build + production)
- [ ] Crear `Dockerfile` para web (multi-stage: build + production con nginx)
- [ ] Crear `Dockerfile` para payment-gateway-mock
- [ ] Actualizar `docker-compose.yml` para incluir las apps (no solo infra)
- [ ] Crear `.dockerignore`
- [ ] Agregar scripts a root package.json: `docker:up`, `docker:down`
- [ ] Verificar que `pnpm build` y `pnpm test` pasan en CI

### Archivos afectados
- Nuevo: `.github/workflows/ci.yml`, `Dockerfile.*`, `.dockerignore`, `.env.example`
- Modificado: `docker-compose.yml`, `package.json` root, `apps/backend/src/index.ts` (rate-limit, logging)

---

## Orden de ejecución

```
Fase 1 (Drizzle + Users)    ← BASE: sin esto nada funciona
       ↓
Fase 2 (JWT Auth)           ← SEGURIDAD: multi-tenancy real
       ↓
Fase 3 (Zod Validation)     ← ROBUSTEZ: datos inválidos no entran
       ↓
Fase 4 (Vitest Tests)       ← CONFIANZA: tests que validan conceptos
       ↓
Fase 5 (CI/CD + DX)         ← PRODUCTION-READY: containerización + CI
```

## Criterios de éxito por fase

| Fase | Criterio |
|------|----------|
| 1 | `pnpm build` compila, queries son type-safe, RLS funciona con Drizzle |
| 2 | Login/logout funciona, JWT valida, tenant A no ve datos de tenant B |
| 3 | Errores de validación retornan 400 con detalles estructurados |
| 4 | `pnpm test` pasa, coverage > 80% en lógica crítica |
| 5 | CI pasa en GitHub, `docker-compose up` levanta todo incluyendo apps |
