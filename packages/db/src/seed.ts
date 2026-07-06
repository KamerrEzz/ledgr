import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

const connectionString =
  process.env.DATABASE_URL ??
  "postgres://ledgr:ledgr_dev@localhost:5432/ledgr";

const client = postgres(connectionString);
const db = drizzle(client, { schema });
import { scryptSync, randomBytes } from "node:crypto";

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export async function runSeeds() {
  await db
    .insert(schema.tenants)
    .values([
      {
        id: "a0000000-0000-0000-0000-000000000001",
        name: "Acme Corp",
        slug: "acme",
      },
      {
        id: "a0000000-0000-0000-0000-000000000002",
        name: "Globex Inc",
        slug: "globex",
      },
      {
        id: "a0000000-0000-0000-0000-000000000003",
        name: "Initech",
        slug: "initech",
      },
    ])
    .onConflictDoNothing();

  console.log("Seeded tenants");

  await db
    .insert(schema.resources)
    .values([
      {
        id: "b0000000-0000-0000-0000-000000000001",
        tenantId: "a0000000-0000-0000-0000-000000000001",
        name: "Cloud Hosting",
        description: "Managed cloud hosting service",
      },
      {
        id: "b0000000-0000-0000-0000-000000000002",
        tenantId: "a0000000-0000-0000-0000-000000000001",
        name: "SSL Certificates",
        description: "Domain-validated SSL certificates",
      },
      {
        id: "b0000000-0000-0000-0000-000000000003",
        tenantId: "a0000000-0000-0000-0000-000000000002",
        name: "Consulting Hours",
        description: "Expert consulting sessions",
      },
      {
        id: "b0000000-0000-0000-0000-000000000004",
        tenantId: "a0000000-0000-0000-0000-000000000003",
        name: "Software License",
        description: "Annual software license",
      },
    ])
    .onConflictDoNothing();

  console.log("Seeded resources");

  await db
    .insert(schema.resourceVariants)
    .values([
      {
        id: "c0000000-0000-0000-0000-000000000001",
        resourceId: "b0000000-0000-0000-0000-000000000001",
        tenantId: "a0000000-0000-0000-0000-000000000001",
        name: "Basic Plan",
        priceCents: 2900n,
        currency: "USD",
      },
      {
        id: "c0000000-0000-0000-0000-000000000002",
        resourceId: "b0000000-0000-0000-0000-000000000001",
        tenantId: "a0000000-0000-0000-0000-000000000001",
        name: "Pro Plan",
        priceCents: 9900n,
        currency: "USD",
      },
      {
        id: "c0000000-0000-0000-0000-000000000003",
        resourceId: "b0000000-0000-0000-0000-000000000002",
        tenantId: "a0000000-0000-0000-0000-000000000001",
        name: "Single Domain",
        priceCents: 499n,
        currency: "USD",
      },
      {
        id: "c0000000-0000-0000-0000-000000000004",
        resourceId: "b0000000-0000-0000-0000-000000000003",
        tenantId: "a0000000-0000-0000-0000-000000000002",
        name: "Standard",
        priceCents: 15000n,
        currency: "USD",
      },
      {
        id: "c0000000-0000-0000-0000-000000000005",
        resourceId: "b0000000-0000-0000-0000-000000000003",
        tenantId: "a0000000-0000-0000-0000-000000000002",
        name: "Premium",
        priceCents: 25000n,
        currency: "USD",
      },
      {
        id: "c0000000-0000-0000-0000-000000000006",
        resourceId: "b0000000-0000-0000-0000-000000000004",
        tenantId: "a0000000-0000-0000-0000-000000000003",
        name: "Annual License",
        priceCents: 49900n,
        currency: "USD",
      },
    ])
    .onConflictDoNothing();

  console.log("Seeded resource variants");

  await db
    .insert(schema.orders)
    .values([
      {
        id: "d0000000-0000-0000-0000-000000000001",
        tenantId: "a0000000-0000-0000-0000-000000000001",
        resourceVariantId: "c0000000-0000-0000-0000-000000000002",
        quantity: 1,
        totalCents: 9900n,
        currency: "USD",
        status: "paid",
        idempotencyKey: "idem-acme-order-001",
      },
      {
        id: "d0000000-0000-0000-0000-000000000002",
        tenantId: "a0000000-0000-0000-0000-000000000001",
        resourceVariantId: "c0000000-0000-0000-0000-000000000001",
        quantity: 3,
        totalCents: 8700n,
        currency: "USD",
        status: "draft",
        idempotencyKey: "idem-acme-order-002",
      },
      {
        id: "d0000000-0000-0000-0000-000000000003",
        tenantId: "a0000000-0000-0000-0000-000000000002",
        resourceVariantId: "c0000000-0000-0000-0000-000000000004",
        quantity: 2,
        totalCents: 30000n,
        currency: "USD",
        status: "pending_payment",
        idempotencyKey: "idem-globex-order-001",
      },
    ])
    .onConflictDoNothing();

  console.log("Seeded orders");

  await db
    .insert(schema.orderStatusTransitions)
    .values([
      {
        id: "e0000000-0000-0000-0000-000000000001",
        orderId: "d0000000-0000-0000-0000-000000000001",
        tenantId: "a0000000-0000-0000-0000-000000000001",
        fromStatus: "draft",
        toStatus: "pending_payment",
        reason: "Customer submitted order",
      },
      {
        id: "e0000000-0000-0000-0000-000000000002",
        orderId: "d0000000-0000-0000-0000-000000000001",
        tenantId: "a0000000-0000-0000-0000-000000000001",
        fromStatus: "pending_payment",
        toStatus: "paid",
        reason: "Payment confirmed by payment processor",
      },
      {
        id: "e0000000-0000-0000-0000-000000000003",
        orderId: "d0000000-0000-0000-0000-000000000003",
        tenantId: "a0000000-0000-0000-0000-000000000002",
        fromStatus: "draft",
        toStatus: "pending_payment",
        reason: "Order placed, awaiting payment",
      },
    ])
    .onConflictDoNothing();

  console.log("Seeded order status transitions");

  await db
    .insert(schema.ledgerEntries)
    .values([
      {
        id: "f0000000-0000-0000-0000-000000000001",
        tenantId: "a0000000-0000-0000-0000-000000000001",
        orderId: "d0000000-0000-0000-0000-000000000001",
        entryType: "credit",
        amountCents: 8910n,
        currency: "USD",
        description:
          "Acme Corp payout for Pro Plan (after 10% commission)",
      },
      {
        id: "f0000000-0000-0000-0000-000000000002",
        tenantId: "a0000000-0000-0000-0000-000000000001",
        orderId: "d0000000-0000-0000-0000-000000000001",
        entryType: "debit",
        amountCents: 990n,
        currency: "USD",
        description: "Platform commission for Pro Plan (10%)",
      },
    ])
    .onConflictDoNothing();

  console.log("Seeded ledger entries");

  await db
    .insert(schema.users)
    .values([
      {
        tenantId: "a0000000-0000-0000-0000-000000000001",
        email: "admin@acme.com",
        passwordHash: hashPassword("password123"),
        role: "admin",
      },
      {
        tenantId: "a0000000-0000-0000-0000-000000000002",
        email: "admin@globex.com",
        passwordHash: hashPassword("password123"),
        role: "admin",
      },
      {
        tenantId: "a0000000-0000-0000-0000-000000000003",
        email: "admin@initech.com",
        passwordHash: hashPassword("password123"),
        role: "admin",
      },
    ])
    .onConflictDoNothing();

  console.log("Seeded users");
}

runSeeds()
  .then(() => {
    console.log("Seeds complete");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
