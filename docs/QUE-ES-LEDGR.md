# Que es Ledgr y como usarlo

Ledgr es un boilerplate de estudio para construir SaaS marketplaces multi-tenant con capa fintech. No es un producto final — es un proyecto para aprender arquitectura real aplicada.

## El problema que resuelve

Cuando construis un SaaS marketplace, enfrentas estos problemas:

1. **Multi-tenancy**: como separar datos de distintos clientes sin que uno vea los datos del otro
2. **Ledger inmutable**: como llevar registro financiero donde nada se puede borrar ni modificar
3. **Split payments**: como dividir un pago entre el vendedor y la plataforma
4. **Idempotencia de webhooks**: como manejar que un gateway de pagos te envie el mismo evento 3 veces

Ledgr demuestra como resolver cada uno de estos con codigo real, no con slides.

## Conceptos de arquitectura que cubre

| Concepto | Que es | Donde esta en Ledgr |
|----------|--------|---------------------|
| Multi-tenancy | Cada tenant solo ve sus datos | PostgreSQL RLS + `SET LOCAL app.current_tenant_id` |
| Ledger inmutable | Registro financiero append-only | Tabla `ledger_entries` — solo INSERT, nunca UPDATE/DELETE |
| Split payments | Pago dividido 90% tenant / 10% plataforma | `createSplitPaymentEntries()` en `services/ledger.ts` |
| Maquina de estados | Transiciones validas de orden | `draft → pending_payment → paid → fulfilled → refunded` |
| Idempotencia | Un webhook duplicado no crea doble cobro | `X-Webhook-Id` + UNIQUE constraint en `webhook_events` |
| Event-driven | Comunicacion asincrona entre servicios | Redis pub/sub via `@ledgr/event-bus` |
| JWT auth | Autenticacion stateless con dual token | Access (15min) + Refresh (7 dias, httpOnly cookie) |
| Drizzle ORM | Queries tipadas con schema-first | `packages/db/src/schema.ts` |

## Arquitectura

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│  Web :3000  │────▶│ Backend :3001│────▶│ Postgres :5432│
│  Next.js 15 │     │   Fastify    │     │  RLS enforced │
└─────────────┘     └──────┬───────┘     └──────────────┘
                           │
                           │ webhook
                           │
                    ┌──────▼───────┐
                    │ Payment Mock │
                    │   :3002      │
                    └──────────────┘
                           │
                    ┌──────▼───────┐
                    │  Redis :6379 │
                    │  pub/sub     │
                    └──────────────┘
```

- **Web**: Dashboard Next.js para interactuar con la API
- **Backend**: API REST con Fastify — CRUD, auth, ledger, webhooks
- **Payment Mock**: Simula un gateway de pagos real (envia webhooks duplicados, falla al azar)
- **Postgres**: Base de datos con RLS — el filtro de tenant es a nivel de DB, no de codigo
- **Redis**: Cola de eventos para comunicacion asincrona

## Como funciona el multi-tenancy

En la mayoria de los SaaS, el multi-tenancy se hace con un filtro `WHERE tenant_id = ?` en cada query. Si el desarrollador olvida ese filtro en UNA query, un tenant puede ver datos de otro.

Ledgr usa **Row-Level Security (RLS)** de PostgreSQL. Esto significa que el filtro lo pone la base de datos, no el codigo:

```sql
-- Policy en la tabla resources
CREATE POLICY tenant_isolation_resources ON resources
  USING (tenant_id::text = current_setting('app.current_tenant_id'));
```

Cada vez que el backend hace una query:

```typescript
// 1. Abre una transaccion
// 2. Ejecuta SET LOCAL app.current_tenant_id = '<tenant-uuid>'
// 3. Hace la query dentro de esa transaccion
withTenantSql(tenantId, async (tx) => {
  return tx.select().from(schema.resources);  // RLS filtra automaticamente
});
```

Incluso si el codigo olvida filtrar por `tenant_id`, PostgreSQL bloquea el acceso cruzado.

## Como funciona el ledger

El ledger es la tabla mas importante del sistema financiero. Es **append-only**: solo se pueden hacer INSERTs, nunca UPDATEs ni DELETEs.

Cuando un pago se confirma, se crean exactamente 2 entradas:

```
Orden de $99.00 pagada:

  CREDIT  $89.10  →  Acme Corp (90%)
  DEBIT   $9.90   →  Plataforma (10%)
```

El balance de un tenant se calcula SIEMPRE sumando el ledger:

```sql
SELECT SUM(CASE WHEN entry_type = 'credit' THEN amount_cents ELSE -amount_cents END)
FROM ledger_entries WHERE tenant_id = '<uuid>';
```

Nunca se almacena un campo `balance` en la tabla de tenants. Si hay un bug que crea una entrada duplicada, el balance lo refleja inmediatamente.

El endpoint `/api/ledger/integrity` verifica que:
1. Cada orden tenga exactamente 2 entradas (1 credito + 1 debito)
2. La suma de credito + debito sea igual al total de la orden
3. No existan entradas huérfanas (que referencien una orden que no existe)

## Como funciona la idempotencia

Los gateways de pagos reales (Stripe, Conekta, MercadoPago) envian el mismo webhook 2-3 veces. Si tu backend lo procesa 3 veces, creas 3 entradas en el ledger en vez de 1.

Ledgr simula esto: el `payment-gateway-mock` envia 2-3 webhooks con el mismo `X-Webhook-Id` y delays aleatorios.

El backend resuelve asi:

```
1er webhook (X-Webhook-Id: abc-123)
  → INSERT en webhook_events (idempotency_key = 'abc-123')
  → OK: procesa el pago, crea ledger entries

2do webhook (X-Webhook-Id: abc-123)
  → INSERT en webhook_events (idempotency_key = 'abc-123')
  → UNIQUE violation (23505)
  → Retorna { status: "duplicate" }, no procesa nada

3er webhook (X-Webhook-Id: abc-123)
  → Igual que el 2do: duplicate, no procesa
```

## Como empezar

### Requisitos
- Node.js 20+
- pnpm 9.x
- Docker + Docker Compose

### Instalacion

```bash
git clone https://github.com/KamerrEzz/ledgr.git
cd ledgr
pnpm install
```

### Levantar la infraestructura

```bash
docker compose up -d
```

Esto levanta PostgreSQL 16 y Redis 7.

### Correr migraciones y seeds

```bash
cd packages/db
pnpm build
pnpm migrate
pnpm seed
cd ../..
```

Esto crea las tablas, habilita RLS, y carga 3 tenants de prueba con usuarios, recursos, variantes, ordenes, y ledger entries.

### Iniciar las apps

```bash
pnpm dev
```

Esto levanta:
- Frontend en http://localhost:3000
- Backend en http://localhost:3001
- Payment Mock en http://localhost:3002

### Login

Abrí http://localhost:3000 y usa estas credenciales:

| Email | Password | Tenant |
|-------|----------|--------|
| admin@acme.com | password123 | Acme Corp |
| admin@globex.com | password123 | Globex Inc |
| admin@initech.com | password123 | Initech |

## Que probar

### 1. Ver aislamiento multi-tenancy

1. Login como Acme (`admin@acme.com`)
2. Ir a Resources — ves "Cloud Hosting" y "SSL Certificates"
3. Ir a Orders — ves 2 ordenes
4. Logout, login como Globex (`admin@globex.com`)
5. Ir a Resources — ves "Consulting Hours" (no ves nada de Acme)
6. Ir a Orders — ves 1 orden (no ves las de Acme)

Los datos estan en la misma base de datos, pero RLS los separa.

### 2. Crear una orden y ver el ledger

1. Login como Acme
2. Ir a Orders → Create Order → seleccionar una variante → cantidad 1
3. La orden se crea en estado `draft`
4. Ir a Ledger — no hay entradas nuevas todavia
5. Ir a Orders → click en la orden → Transition → `pending_payment`
6. Transition → `paid`
7. Ir a Ledger — ahora ves 2 entradas nuevas (credito + debito)

### 3. Verificar webhook idempotencia

```bash
# Login
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@acme.com","password":"password123"}' | node -pe "JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).access_token")

# Enviar webhook
curl -s -X POST http://localhost:3001/api/webhooks/receive \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Id: test-dup-001" \
  -d '{"event_type":"payment.completed","order_id":"<order-id>","tenant_id":"<tenant-id>","amount_cents":9900,"currency":"USD"}' \
  -H "Authorization: Bearer $TOKEN"
# → { "status": "processed" }

# Enviar el mismo webhook otra vez
curl -s -X POST http://localhost:3001/api/webhooks/receive \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Id: test-dup-001" \
  -d '{"event_type":"payment.completed","order_id":"<order-id>","tenant_id":"<tenant-id>","amount_cents":9900,"currency":"USD"}' \
  -H "Authorization: Bearer $TOKEN"
# → { "status": "duplicate" }
```

### 4. Verificar integridad del ledger

```bash
curl -s http://localhost:3001/api/ledger/integrity \
  -H "Authorization: Bearer $TOKEN"
# → { "isValid": true, "errors": [], "stats": { ... } }
```

### 5. Ver balance en tiempo real

```bash
curl -s http://localhost:3001/api/balance \
  -H "Authorization: Bearer $TOKEN"
# → { "totalCents": "8910", "totalDebits": "990", "netBalance": "7920", "currency": "USD" }
```

## Estructura del proyecto

```
ledgr/
├── apps/
│   ├── backend/              API Fastify
│   │   └── src/
│   │       ├── routes/       Endpoints REST
│   │       ├── services/     Logica de negocio
│   │       ├── consumers/    Eventos Redis
│   │       ├── schemas/      Validacion Zod
│   │       └── lib/          Auth, tenant-sql, validate
│   ├── web/                  Dashboard Next.js
│   │   └── src/
│   │       ├── app/          Paginas (App Router)
│   │       ├── components/   Componentes reutilizables
│   │       └── lib/          API client, auth context, format
│   └── payment-gateway-mock/ Gateway simulado
├── packages/
│   ├── db/                   Schema Drizzle, migraciones, seeds
│   ├── shared-types/         Tipos TS compartidos
│   └── event-bus/            Wrapper Redis pub/sub
├── docs/
│   ├── ARCHITECTURE.md       Por que cada decision de arquitectura
│   ├── ERD.md                Diagrama Mermaid de la DB
│   ├── HANDOFF.md            Como levantar y probar todo
│   └── ROADMAP.md            Estado del roadmap v2
├── docker-compose.yml
└── turbo.json
```

## API endpoints

| Metodo | Endpoint | Descripcion | Auth |
|--------|----------|-------------|------|
| POST | /api/auth/login | Login | No |
| POST | /api/auth/refresh | Refresh token | Cookie |
| POST | /api/auth/logout | Logout | No |
| GET | /api/auth/me | Usuario actual | JWT |
| GET | /api/resources | Listar recursos | JWT |
| POST | /api/resources | Crear recurso | JWT |
| GET | /api/orders | Listar ordenes | JWT |
| POST | /api/orders | Crear orden | JWT |
| POST | /api/orders/:id/transition | Transicionar orden | JWT |
| GET | /api/balance | Balance actual | JWT |
| GET | /api/ledger | Entradas del ledger | JWT |
| GET | /api/ledger/integrity | Verificar integridad | JWT |
| POST | /api/webhooks/receive | Recibir webhook | No |

## Correr tests

```bash
# Unit tests (34 tests)
pnpm test

# E2E tests (Playwright)
cd apps/web
npx playwright test --headed
```

## Donde profundizar

- **[ARCHITECTURE.md](ARCHITECTURE.md)** — Las razones detras de cada decision de arquitectura
- **[ERD.md](ERD.md)** — Diagrama completo de la base de datos
- **[HANDOFF.md](HANDOFF.md)** — Guia tecnica paso a paso con comandos curl
- **[ROADMAP.md](ROADMAP.md)** — Estado del roadmap y tareas pendientes
