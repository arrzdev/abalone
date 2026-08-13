---
name: stack-api-routes
description: Writing Hono routes in this repo: where route files and middleware live, the exact import sources, validation via valid(), rate-limit before auth, and success-path-only handlers. Use when adding or editing a .routes.ts, endpoint, or middleware.
---

# API routes

Routes are the **HTTP adapter** — thin handlers only.

## Where code lives (`apps/backend/src/http/`)

| What | Path | Notes |
|------|------|-------|
| Routes | `routes/{domain}.routes.ts` | one file per domain |
| Route composition | `routes/index.ts` | mounts domains under the version prefix — a composition root, **not** a barrel (`core-repository-layout`) |
| App assembly | `api.ts` | the Hono app: global middleware, `onError`, route mount |
| Middleware | `middlewares/` | `auth.ts`, `rate-limit.ts`, `valid.ts`, `error-catcher.ts` |
| Envelope | `envelope.ts` | `ok` / `error`, bound to `ERROR_CODES` |
| Error model | `errors.ts` | `ERROR_CODES`, `ErrorCode`, `CustomError` |
| RPC contract | `interface.ts` | the type the frontend `import type`s — the only export the app publishes |
| Validation schemas | colocated with the route | |

Import sources that are easy to guess wrong:

| Symbol | From |
|---|---|
| `newEndpoint`, `createApiEnvelope` | `@repo/shared/http` |
| `ok`, `error` | `@/http/envelope` |
| `CustomError`, `ErrorCode` | `@/http/errors` |
| `valid`, `requireAuth`, `rateLimit` | `@/http/middlewares/*` |
| `getDb`, `Db` | `@/database/client` |

No business logic or DB access in routes — delegate to services/facades.

**The backend has `services/` only today** — no `facades/` and no `modules/` folder exists yet. That's not a signal they're unwanted: the first orchestration across 2+ services creates `facades/`, and the first service that needs a second source file creates `modules/<domain>/`. Both triggers are objective, not judgment calls (`core-backend-architecture`, `core-repository-layout`). Don't put orchestration in a service because the folder isn't there.

## Handler rules

1. Register middleware (`rateLimit`, auth) on the chain.
2. Put `valid(target, schema)` in the **same route tuple** as the handler — it validates and exposes the typed `c.req.valid(target)`.
3. Instantiate the service/facade with its dependencies (`new XService(getDb(c.env.DB))`).
4. **`return ok(c, data)`** on success — **only** success path in the handler.
5. Do **not** catch domain errors or call `error(c, code)` for service failures — services throw; global middleware maps envelopes.

Zod validation failures are handled in validation middleware **before** the handler (`invalid_input`).

## Template

```ts
export const userRoutes = newEndpoint<Env>()
  .post("/", valid("json", createUserSchema), async (c) => {
    const body = c.req.valid("json") // inferred from the schema
    const userService = new UserService(getDb(c.env.DB))
    const user = await userService.createUser(body)
    return ok(c, { user }, 201)
  })
```

**Section the chain:** put a `//---- <name> ----` banner (blank line before) between each route method so list/create/update/delete read as distinct blocks. Biome preserves both the banner and the spacing inside the chain.

## Validation

An **early-return middleware**: a Zod failure throws `invalid_input`, the global handler renders the envelope, and the handler never runs — so handlers read `c.req.valid(target)` and assume the input is good. Wrap `@hono/zod-validator`'s `zValidator` once to bind that envelope:

```ts
export function valid<
  Target extends keyof ValidationTargets,
  Schema extends ZodType,
>(target: Target, schema: Schema) {
  return zValidator(target, schema, (result) => {
    if (!result.success) throw new CustomError("invalid_input")
  })
}
```

**Do not annotate `valid`'s return type** — it flattens the phantom type Hono reads to type `c.req.valid`. One `valid(target, schema)` per target in the route tuple.

## Typing

- `newEndpoint<Env, Variables>()` fixes `c.get` and validated request types.
- Extend `Variables` when middleware adds `c.set` keys.
- **Read validated input via `c.req.valid("json" | "query" | "param")`** — inferred from the schema, so it can't drift. Never hand-write the read type or reach for string-keyed helpers + `as never` casts.

## Auth and rate limiting

Use the shared middleware; read identity from the context (`c.get("user")`), typed by passing `AuthedVariables` as the second `newEndpoint` generic. Do not hand-parse tokens in routes when middleware already exposes identity.

```ts
export const syncRoutes = newEndpoint<Env, AuthedVariables>()
  //rate-limit BEFORE auth so a flood is shed before paying a session lookup
  .use("*", rateLimit("sync"))
  .use("*", requireAuth())
```

**Order matters:** `rateLimit` first, `requireAuth` second. Auth costs a session lookup; shedding the flood before that is the whole point. Reversing the two is a real (and invisible) regression.

## Generic routes over per-domain routes

Where a domain is parameterised rather than distinct, take the parameter. The sync surface is one route pair (`/:collection/pull`, `/:collection/push`) serving every collection — adding a collection needs **no** route change (`stack-sync-engine`). Reach for a `:param` before copy-pasting a fourth near-identical route file.
