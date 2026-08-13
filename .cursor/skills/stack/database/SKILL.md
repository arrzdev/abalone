---
name: database
description: >-
  Drizzle ORM + Cloudflare D1: injected db handle, queries in service methods, db.batch atomicity,
  transaction batch-style limits, facade orchestration. Load for DB queries, batch, transaction.
---

# Database (Drizzle + D1)

## The db handle

A cached `getDb(binding)` factory builds the Drizzle D1 client and reuses it per binding (a binding is stable within an isolate). Services receive that `Db` by constructor injection and use `this.db` in methods.

Services are **agnostic** — they do not know if `db` is the real connection or a transaction handle.

## Where queries live

**Inside service class methods** — no separate `queries.ts` file. One file tells the full story: query + validation + domain rules.

## Atomicity

| Need | Owner | Pattern |
|------|-------|---------|
| Single-domain writes | **Service** | `await` one or more statements when no cross-domain atomicity required |
| Cross-service atomicity | **Facade** | `db.transaction(async (tx) => { … })`, passing `tx` to each service |

```ts
await db.transaction(async (tx) => {
  const user = await new UserService(tx).createUser(data)
  await new WalletService(tx).initWallet(user.id)
})
```

**Errors:** service methods wrap their own fallible work in `tryCatch` and throw `CustomError`. Inside the transaction callback, **await services directly** — their throws roll back the tx. The facade does not `tryCatch` each call unless orchestration needs a corrective branch (e.g. idempotency lookup before the tx).

## D1 + `db.transaction()` nuance

Drizzle `db.transaction()` on D1 is **batch-style** — statements are collected and sent together at the end, not interactive query-by-query.

**Do not** use a read result inside the same transaction callback to build a dependent write:

```ts
// ❌ wrong on D1
await db.transaction(async (tx) => {
  const [row] = await tx.select().from(users).where(...)
  await tx.insert(wallets).values({ userId: row.id })
})
```

**Read-then-write pattern:**

1. **Read phase** — `await` read(s) or `db.batch` for parallel reads.
2. **Decide** in application code.
3. **Write phase** — `db.batch([...])` for atomic writes (all-or-nothing).

## `db.batch` rules

```ts
// ✅ single statement — plain await
const row = await db.select().from(users).where(eq(users.id, id)).get()

// ✅ parallel independent reads
const [[balance], charges] = await db.batch([findBalance(userId), getCharges(userId)])

// ✅ atomic writes
await db.batch([insertLedger(values), adjustBalance(userId, delta)])

// ❌ batch wrapping a lone statement unnecessarily
await db.batch([singleUpdate])

// ❌ atomic writes split across separate awaits
await db.insert(ledger).values(data)
await db.update(balances).set(...)
```

## Query style

- Prefer selecting specific fields on wide tables.
- Private `where*` helpers as class methods when duplicated.
- Naming: `find*` (0–1), `get*` (0–N), `exists*` for presence.

## Migrations

Schema/DDL changes: **stop and ask the human** backward-compatible vs destructive before writing migration SQL.

**Forbidden** without explicit human acceptance: remote migration apply from the agent.
