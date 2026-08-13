---
name: backend-architecture
description: >-
  Backend layers: transport-agnostic services and facades, HTTP routes as adapter, dependency injection,
  who throws errors, facade orchestration. Load for services, facades, domain logic, layering.
---

# Backend architecture

## Three layers

| Layer | Owns | Uses other services? | HTTP-aware? |
|-------|------|---------------------|-------------|
| **Service** / **module** | one domain's logic | **never** | No |
| **Facade** | orchestration across 2+ services | yes — that's its job | No |
| **Route** | validation, auth → call one service/module *or* a facade → `ok(c, data)` | — | Yes |

Services and facades are plain TypeScript — callable from CLI, jobs, or HTTP. Routes are the transport adapter (REST today; read the API app for the framework). A **module** (`modules/x/`) is just a service too big for one file — same rules, a folder instead of a file (see `core/repository-layout`).

## What a service is (and isn't)

A service **owns one domain behind a class**, with dependencies **constructor-injected**. That's the whole definition — a service is *not* "a thing with a database table." The DB is the most common dependency, not a requirement:

- **DB-backed** (the common case): `new ItemsService(db)`.
- **Other resource / handle**: `SyncService` wraps a live document-sync server; a cache over KV; a queue producer.
- **Stateless / pure compute**: a token verifier (takes a signing secret), a validator — some take a single handle, some take nothing.

The tell of a service is a **cohesive single domain + a callable method surface**, not persistence. A stateless domain is still a service (or a module, once it outgrows one file).

## Dependency injection

Services are classes; dependencies are **constructor-injected and resource-agnostic**. Inject the narrow handle the service needs — a `Db`, an R2 bucket, a KV namespace, an API key, or nothing — never an HTTP/request context:

```ts
class ItemsService {
  constructor(private db: Db) {}
}
```

- Wire it at the call site: `new ItemsService(getDb(c.env.DB))`. A cached `getDb(binding)` factory owns construction; the route hands the service its `db`.
- The service **does not know** if `db` is a connection or a transaction handle — same Drizzle interface, so the same class works inside `db.transaction`.
- Don't manufacture a per-request `appContext` Variable + middleware to carry a dep the route can inject directly. Group deps in a small context object only when a service genuinely needs several — not as the default.

## Who calls whom

- Routes call a **service** or **module** directly when one domain suffices — the common case; don't add a facade you don't need.
- **A service never calls another service.** Sibling composition lives one layer up (a facade), never inside a service.
- **The moment you need to orchestrate 2+ services, that's a facade** (`{domain}.facade.ts`) — full stop, *not* "a service that imports another service." Atomicity/branching are things a facade *can* own, not the bar for creating one; orchestration alone is the bar. Tells you have a facade hiding as a service: it constructs/holds another service, spans a cross-domain transaction, or branches on one service's outcome into another's path.
- A **module** (`modules/x/`) is a service that outgrew one file; call it exactly like a service. See `core/repository-layout` for the file→folder→package ladder.

## Facades — building one

A facade is a class that **composes services it constructs**; it owns the orchestration a service is forbidden to. To build one:

1. **Domain services stay pure** — each keeps its own domain methods and exposes any granular operation the facade needs as a **public** method (`items.deleteAllForUser(userId)`, `sync.purgeDocumentsForUser(userId)`). They shed the orchestration *and* the sibling-service imports.
2. **The facade holds the flow** and is constructed with the services: `new AccountDeletionFacade(items, sync)` — it receives services, not a `Db` (unless it also owns its own reads).
3. **Callers construct the facade** — routes / crons / consumers do `new XFacade(new A(db), new B(db)).run()`.

Two shapes:

- **Wholesale** — a "service" that was *only ever* orchestration (no domain of its own) becomes a facade outright: `account.facade.ts` (no account table; it composes items + sync + auth reads for the account screen).
- **Extracted** — a real domain service that grew one orchestration method: pull just that method into a facade, leave the service its domain. `account-deletion.facade.ts` (the cascade delete pulled out of `items.service` / `sync.service`).

**Single-collaborator edges count too.** If a service needs one *datum* from another domain (sync delivery needs the user's device token), don't hand it the other **service** — hand it the **data**, and let the caller fetch it (`SyncService` takes the plain token; the caller reads it from `AuthService`). That keeps the delivery service dependency-free instead of manufacturing a facade for a single value.

## Error ownership

| Layer | Errors |
|-------|--------|
| **Service / facade** | `tryCatch` → analyse → `throw CustomError(code, cause?)` |
| **Facade** | Branch when service A failing implies path B |
| **Route** | **Success path only** — no `if (err) return error(...)`, no service outcome branching |

Throws bubble to global HTTP error middleware.

## Facade atomicity (when the orchestration must be atomic)

```ts
await db.transaction(async (tx) => {
  const user = await new UserService(tx).createUser(data)
  await new WalletService(tx).initWallet(user.id)
})
```

Any `throw` from a service inside the callback aborts the transaction. **Do not** wrap each service call in `tryCatch` in the facade — services already throw `CustomError`. Use `tryCatch` in the facade only for **orchestration branching** (e.g. idempotency lookup, alternate path when a read fails in a recoverable way), typically before or after the transaction — not to re-translate errors the service already owns.

## Route handler shape

```ts
const userService = new UserService(getDb(c.env.DB))
const user = await userService.getUser(id)
return ok(c, { user })
```
