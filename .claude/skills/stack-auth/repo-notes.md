# Auth: repo-specific notes (abalone)

Older notes about this repo's auth wiring, kept for what the standard does not
cover (the profiles mirror, trusted origins, the token store).
**`SKILL.md` in this folder is the standard and wins on any conflict.** The
custom password hash these notes once described was removed in 2026-10
(better-auth's default now runs native scrypt on Workers), and the 5-minute
cookie cache is a gap to remove, not a rule.

Auth is **better-auth** wrapped in a thin `AuthService`. better-auth owns the whole flow — sign-in/up/out with a username and password, `get-session` — mounted under `basePath: /api/v1/auth` and driven by its client SDK on the frontend. What this repo owns is only: forwarding requests to that handler and resolving the current user for its own routes.

## Where it lives

| Piece | Path |
|---|---|
| Service + better-auth instance | `apps/backend/src/services/auth.service.ts` |
| Route gate | `apps/backend/src/http/middlewares/auth.ts` (`requireAuth`, `AuthedVariables`) |
| Mounted handler + sign-in lockout routes | `apps/backend/src/http/routes/auth.routes.ts` |
| Dev-vs-prod network policy | `apps/backend/src/http/network-policy.ts`, `utils/is-private-origin.ts` |
| better-auth tables | `apps/backend/src/database/auth.schema.ts` (separate from app schema) |
| Client SDK + token store | `apps/<app>/src/data/auth/` |

## Sessions are bearer tokens, not cookies

Chosen when the PWA and the API were different origins, where cross-origin cookies are a permanent source of pain (Safari/ITP especially). The API now answers under `/api/v1` on the game's own origin, and the tokens stayed (the exception in `SKILL.md`). The `bearer()` plugin is enabled and:

1. The server returns the token in a **`set-auth-token`** response header on every auth response.
2. The client stashes it in `localStorage` (`data/auth/token.ts`).
3. The typed RPC client attaches `Authorization: Bearer …` on every request (`stack-frontend-data`).

**`data/auth/token.ts` is deliberately import-free.** The RPC client needs the token, and the auth client depends on the RPC client — a token store that imported either would close the cycle. Keep it dependency-free; don't "tidy" it by importing the auth client.

## A performance landmine on Workers

**The better-auth instance is cached per isolate.** Constructing it per request costs CPU on every request (on the old Free plan's 10 ms limit it showed up as random 500s on cold sign-in). It's cached in a `Map` keyed by the `Db` handle, and `getDb()` returns a stable handle per binding — so the cache is effectively per-isolate. Don't move construction into the request path. `resetAuthForTests()` clears it so a fresh env/secret takes effect in tests.

## Trusted origins come from config, never from an env flag

`allowsPrivateOrigins()` decides whether CORS reflects and better-auth trusts localhost/LAN origins. It is derived from **whether every configured `FRONTEND_URLS` origin is itself private** — not from `NODE_ENV` or `CI`. `every`, not `some`: one stray localhost entry in a production list must not switch dev mode on.

This is a fixed security bug, not a style choice: a deployed Worker cannot reliably read a build/process flag at module load (secrets arrive per-request, and `process.env.CI` is simply *absent* in production), so the old `process.env.CI !== "true"` evaluated to **true in production** — dev mode, live. A production `https` frontend now yields `false`, so private origins are never reflected or trusted in prod.

**Never reintroduce a process/build flag here.** If you need a new dev-only network behavior, derive it from validated config the same way (`stack-env-config` — the backend registry pins `internals.DEV` to `false` for exactly this reason, so it fails closed).

One non-obvious detail in the dynamic `trustedOrigins` callback: better-auth's `createAuthContext` probes `getTrustedOrigins()` **with no request** at init. Return `[]` for that case — the guard is `if (request === undefined) return []`. Drop it and init throws.

## Gating a route

```ts
export const inviteRoutes = newEndpoint<Env, AuthedVariables>()
  .use("*", rateLimit("api"))
  .use("*", requireAuth())
```

- Pass `AuthedVariables` as the second generic so `c.get("user")` is typed.
- **`rateLimit` before `requireAuth`** — auth costs a session lookup; shed floods first (`stack-api-routes`).
- `requireAuth` throws `unauthorized`; the global catcher renders the envelope. Handlers stay success-path only.
- Session resolution **fails closed**: any error resolving the session is treated as *guest*, so a gated route returns `unauthorized` rather than leaking through.

**Guests are a supported state, not an error.** A signed-out user never reaches user-scoped routes and offline play stays fully local. Don't add a global redirect-to-login that breaks offline use.

## No OAuth providers

Sign-in is a username and a password only: no email, no OAuth, no provider-discovery route. Adding a provider is a product decision before it is code.

## App data never lives on better-auth's tables

better-auth owns its own schema (`auth.schema.ts`). A `databaseHooks.user.create.after` hook mirrors every new auth user into the app's own `profiles` row (`onConflictDoNothing`), and **app-editable fields you add (the avatar today) live there**, never on better-auth's `user` table. The one exception is the handle: the `username` plugin keeps `username` / `displayUsername` on `user`, because it owns their uniqueness. Writing app fields onto its tables couples you to its migrations.

