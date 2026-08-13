---
name: core-try-catch
description: The tryCatch helper and the failure model: return a value or throw a CustomError, wrap only where you must react, and never double-wrap inside a transaction. Use when handling fallible I/O, parsing, network, or database calls.
---

# tryCatch pattern

Use a shared **`tryCatch(fn)`** helper instead of raw `try/catch` when wrapping fallible work.

## Failure model (the design)

Functions **return a value on success, `throw` a `CustomError` on failure.**

- Callers that can't recover **let the throw bubble** to the global handler — one place maps it to the client envelope. Zero propagation boilerplate.
- Callers that **need to react** wrap the call in `tryCatch` to get the `[data, error]` tuple and fork locally.
- **Absence is not failure** — a `find*` lookup returns `null` (a value); only a real failure throws (see `stack-database` naming).
- Throws compose with transactions: any throw inside `db.transaction` rolls it back automatically.

This keeps propagation DRY, makes branching explicit *only where it matters*, and centralizes the client contract.

## Contract

- Returns `[data, null]` on success or `[null, Error]` on failure.
- Sync callbacks return a tuple; thenable callbacks return a **Promise** of that tuple.
- **`await tryCatch(...)`** when the callback returns a thenable (Promises, Drizzle builders, etc.).

```ts
const [user, userError] = await tryCatch(() =>
  db.select().from(users).where(eq(users.id, id)).get(),
)

if (userError) throw new CustomError("database_connection_error", userError)
```

## Thenables (`isThenable`)

The helper treats any object with a `.then` function as async — not only `instanceof Promise`. Drizzle query builders, some Bun fs APIs, and other libraries return thenables that are not Promise instances.

## Overload ordering

The **Promise overload is declared first** so `() => Promise<T>` is not inferred as sync `T = Promise<T>`. TypeScript picks the right overload from the callback return type.

## Tuple naming

First element = success value; second = error. **Full words, no abbreviations** — `userError`, `insertError`, never `err` (see `core-code-style` naming). To branch on a *specific* error code, use the typed guard in `core-custom-errors` rather than a raw string compare.

## Where to use

| Layer | Usage |
|-------|--------|
| **Service** | Wrap fallible DB/network work inside the method; analyse `error`; throw domain error |
| **Facade** | `tryCatch` for **orchestration branching** — not to re-wrap every service call (services already throw) |
| **Data module** | Wrap client calls in `queryFn` / `mutationFn` when not using throw-through |
| **Route** | **Do not** branch on service outcomes — services throw; global handler maps HTTP |

## Facade + `db.transaction`

The tryCatch-specific rule: **don't double-wrap.** Services already throw `CustomError`, so inside a transaction `await` them directly — any throw rolls back. Use `tryCatch` in a facade only for **orchestration branching** (e.g. an idempotency lookup before the tx), not around every call.

```ts
// ❌ redundant — service already throws
const [user, userError] = await tryCatch(() => new UserService(tx).createUser(data))
if (userError) throw new CustomError("database_connection_error", userError)

// ✅ let the throw propagate and roll back the tx
const user = await new UserService(tx).createUser(data)
```

Canonical transaction + cross-service atomicity pattern: `core-backend-architecture`; D1 batch nuance: `stack-database`.

## Anti-patterns

### Unnecessary `async () =>` wrapper

```ts
// ❌ unnecessary async wrapper — double-wraps the thenable
const [user, userError] = await tryCatch(async () =>
  db.select().from(users).where(eq(users.id, id)).get(),
)

// ✅ sync callback returning the thenable
const [user, userError] = await tryCatch(() =>
  db.select().from(users).where(eq(users.id, id)).get(),
)
```

### Other

- `const [, error] = …; void error` — handle or rethrow deliberately.
- Catching in routes to return error envelopes — forbidden.
- `tryCatch` on every service call inside a facade transaction — services already throw.

## Raw try/catch

Rare — only when `tryCatch` cannot express the control flow. Brief comment why.
