---
name: api-routes
description: >-
  HTTP route handlers: Hono thin routes, Zod validation middleware, success-only handlers,
  ok() responses. Load for endpoints, .routes.ts, REST API, middleware chains.
---

# API routes

Routes are the **HTTP adapter** — thin handlers only. Read the API app for exact helpers (`newEndpoint`, `ok`, middleware factories, variable types).

## Where code lives

| What | Typical path |
|------|----------------|
| Routes | `src/http/routes/{domain}.routes.ts` |
| Middleware | `src/http/middlewares/` |
| Validation schemas | colocated with route |

No business logic or DB access in routes — delegate to services/facades.

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

## Auth

Use shared auth middleware; read identity from `c.get("auth")`. Do not hand-parse tokens in routes when middleware already exposes identity.
