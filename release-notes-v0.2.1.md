# v0.2.1 — RLS Security Hardening

## What Changed

🔒 **Security**: Row-Level Security policies have been hardened across all database tables to enforce data isolation at the database level — not just in application code.

### Ledger Append-Only Enforcement

The `ledger_entries` and `order_status_transitions` tables are now truly append-only at the PostgreSQL level. Previously, RLS policies filtered by `tenant_id` but still allowed UPDATE and DELETE operations. Now:

- **SELECT + INSERT only** — no UPDATE/DELETE policies exist
- PostgreSQL's default behavior: without a policy for an operation, it's **denied**
- A buggy or compromised application cannot modify or delete financial records

### Explicit WITH CHECK Clauses

All tenant tables now have explicit `WITH CHECK` clauses on INSERT policies. This ensures:

- A user cannot insert a row with a `tenant_id` different from their JWT token
- The database validates the tenant boundary on every write, not just reads

### Policy Summary

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| ledger_entries | ✅ | ✅ | ❌ Blocked | ❌ Blocked |
| order_status_transitions | ✅ | ✅ | ❌ Blocked | ❌ Blocked |
| orders | ✅ | ✅ | ✅ | ❌ Blocked |
| resources | ✅ | ✅ | ✅ | ✅ |
| resource_variants | ✅ | ✅ | ✅ | ✅ |

### Migration

- **Fresh installs**: Migration 008 updated with correct policies
- **Existing databases**: New migration 011 applies the hardened policies
- Run `pnpm migrate` after updating to apply changes
