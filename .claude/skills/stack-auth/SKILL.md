---
name: stack-auth
description: The TUDU auth standard — better-auth on Cloudflare Workers with D1 sessions checked on every request (no cookie cache, no KV), Cloudflare rate-limit bindings as the only limiter, a per-account lockout in D1, the default native password hash with a bundle guard, and a React session cache that is stale-while-revalidate. Use when touching sign-in, sign-up, sign-out, sessions, requireAuth, rate limits on auth routes, the client session cache or protected pages, or when adding auth to a project.
---

# Auth standard (better-auth on Workers)

**This is the standard for every TUDU product.** The board decided it once
(2026-10, after a better-auth security audit) so nobody redesigns it per
project. The reference implementation is `arrzdev/tudu-monorepo-template`
(`apps/backend` + `apps/web`); a repo that predates it moves toward it, never
away. Changing a rule below is an architecture decision for the CTO, with the
reason written down — not a per-task choice.

Route mechanics: `stack-api-routes`. Env vars: `stack-env-config`. Tables and
migrations: `stack-database`, `stack-database-migrations`.

## In this repo (checked 2026-10-20)

At the standard since 2026-10-20, with one noted exception (bearer sessions).
What is true now:
- Backend: `session.cookieCache` is off and better-auth's `rateLimit` is
  disabled (`apps/backend/src/services/auth.service.ts`). The session is read
  from D1 on every request; D1 failing is `service_unavailable` (503), not a
  guest. `requireAuth()` forwards the renewed `set-auth-token` / `Set-Cookie`.
- Backend: the `auth` preset is `AUTH_BURST_RATE_LIMITER` (5/10 s) +
  `AUTH_SUSTAINED_RATE_LIMITER` (20/60 s), and `AUTH_FAILURE_RATE_LIMITER` caps
  failed sign-ins per IP. The per-account lockout (`auth-lockout.service.ts`,
  table `auth_lockouts`) covers both `POST /sign-in/email` and
  `/sign-in/username`, keyed on the email (a username maps to its derived
  `@users.abalone.invalid` email). Locked → `auth_account_locked` (429) +
  `Retry-After`. Cookie POSTs from a foreign `Origin` → `forbidden_origin` (403).
- Client (`apps/game`): the cached session is a summary only,
  `{ user, expiresAt }` under `abalone.session`
  (`src/data/auth/session-snapshot.ts`), `expiresAt` in epoch ms from the
  session the api returned. An expired summary paints no user and
  `needsSignIn()` (`src/routing/auth-guard.ts`) sends the device to sign in at
  once; `AuthProvider` drops the token with it. A live one paints at once while
  get-session re-checks it.
- Client: any 401 from a data call (`apiError("unauthorized")` in
  `src/data/backend-client.ts`) or from get-session ends the session
  (`src/data/auth/session-end.ts`: token, snapshots, query cache), and the
  token subscription in `src/routing/signed-in-only.tsx` opens sign-in. A 503
  or a network error changes nothing. Sign-out clears locally first, even
  when the call fails.
- Client: a locked sign-in shows "Too many attempts. Try again later."
  (`AuthError` code `account_locked`; `common:auth.errors.account_locked` in
  all 13 locales, never the wait in `Retry-After`).
- **Exception, kept:** sessions are bearer tokens in `localStorage`
  (`apps/game/src/data/auth/token.ts`), from when the PWA and the API were on
  different origins. The standard is an httpOnly cookie on one origin (routing
  map). Moving needs a CTO decision; until then keep the token store
  import-free and add no second token store.

Repo-specific notes (OAuth providers, profiles mirror, trusted origins): `repo-notes.md` in this folder. Where they conflict with this file, this file wins.

Do not widen the bearer exception or reopen a gap (no cookie cache, no
in-memory limiter, no new token in client storage).

## The rules, and why

| # | Rule | Why |
|---|---|---|
| 1 | **better-auth, latest version, default password hash.** No custom `emailAndPassword.password` hash/verify. | better-auth picks native `node:crypto` scrypt under workerd by itself (`@better-auth/utils` `password.node.mjs`). The old custom hashes used the same params and `salt:key` format, so they keep verifying. Pure-JS scrypt (`@noble/hashes`) took 4.5–5 s of CPU per sign-in on Workers (better-auth#8860) and failed as timeouts. |
| 2 | **The build fails unless the bundle holds `password.node.mjs` and not `@noble/hashes/scrypt`** (`scripts/check-password-bundle.ts`, run by `pnpm build`). | A resolver change once shipped the pure-JS build again (better-auth#9649). This catches it before a deploy instead of in production CPU time. |
| 3 | **Sessions live in D1 (drizzle adapter). `session.cookieCache` off. No `secondaryStorage`, no KV, no `better-auth-cloudflare` plugin.** The API checks the session in D1 on **every** request. | **Instant revocation:** sign-out, a revoked session or a deleted user fails on the next request; a cookie cache keeps a dead session alive for its `maxAge`. **KV is out because of the board's plan:** Workers Free KV allows 1,000 writes/day and 100,000 reads/day ([KV limits](https://developers.cloudflare.com/kv/platform/limits/)); D1 Free allows 5 million rows read and 100,000 rows written per day ([D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/)). |
| 4 | **Rate limit = Cloudflare Workers rate-limit bindings. better-auth `rateLimit: { enabled: false }`.** One limiter only. | The binding is free and shared by every isolate in a location. better-auth's default store is memory, which on Workers counts per isolate and barely limits. Storing counters in D1 would spend the write budget of rule 3. |
| 5 | **Per-account lockout in D1: 5 failed sign-ins for one account within 15 min → that account is locked 15 min, from any IP.** Checked **before** the password is hashed. The count starts over only 15 min after the *last* failure. | Stops brute force through many proxies against one account. The binding cannot do it: its period is only 10 s or 60 s and it counts per location ([rate-limit binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)). Checking first means a locked account costs no scrypt CPU. |
| 6 | **The client caches only a session summary and is stale-while-revalidate.** | Instant routing and redirects without waiting for the API, while the API (rule 3) still refuses anything a dead session asks for. A late client-side sign-out can only show an empty page, never data. |

## Backend (template paths)

| Piece | Path |
|---|---|
| better-auth instance + sign-in/up/out + session read | `apps/backend/src/services/auth.service.ts` |
| Lockout (D1 upsert, 5 / 15 min / 15 min) | `apps/backend/src/services/auth-lockout.service.ts` |
| Route gate `requireAuth()`, `AuthedVariables` | `apps/backend/src/http/middlewares/auth.ts` |
| Auth routes (the only auth surface) | `apps/backend/src/http/routes/auth.routes.ts` |
| Rate-limit tiers + failed-sign-in cap | `apps/backend/src/http/middlewares/rate-limit.ts`, `[[ratelimits]]` in `wrangler.toml` |
| better-auth tables + `auth_lockouts` | `apps/backend/src/database/auth.schema.ts` (both schema files in `drizzle.config.ts`) |
| Bundle guard | `apps/backend/scripts/check-password-bundle.ts` |
| Tests | `auth.routes.test.ts`, `rate-limit.test.ts`, `password-hash.test.ts` |

**Routes:** `POST /api/v1/auth/sign-in`, `/sign-up`, `/sign-out`, `GET /api/v1/auth/session`.
better-auth's catch-all handler is **not mounted**: every endpoint it would
expose (a sign-in that skips the lockout, for one) stays unreachable. A new
auth feature adds an explicit route.

**Session = httpOnly cookie.** The API and the website share one origin
(`<domain>/api/v1`, routing map), so the cookie is first-party and the page
never sees a token. No response body carries a token. (abalone predates this
and uses the `bearer()` plugin with a token in `localStorage`; new projects use
the cookie.)

**`requireAuth()`** reads the session from D1 every time. No session → `unauthorized` (401).
When better-auth extends a session (once a day of use), `requireAuth()`
forwards the renewed `Set-Cookie` on the response; drop it and the browser
cookie dies after 7 days while D1 still says the session is live.
D1 failing → `service_unavailable` (503), never 401, so a D1 blip does not sign
the user out on the client. Order on a route: `rateLimit(...)` first, then
`requireAuth()`.

**Rate-limit tiers** (limits in `wrangler.toml` must match the comments in `rate-limit.ts`):

| Binding | Limit | Applies to |
|---|---|---|
| `AUTH_BURST_RATE_LIMITER` | 5 / 10 s per IP | `auth` preset: sign-in, sign-up |
| `AUTH_SUSTAINED_RATE_LIMITER` | 20 / 60 s per IP | `auth` preset (roomy for an office behind one NAT) |
| `AUTH_FAILURE_RATE_LIMITER` | 10 failed sign-ins / 60 s per IP → 10-min cooldown | `recordAuthFailure` / `assertAuthFailureNotCapped`; marker in `caches.default` |
| `HEALTH_RATE_LIMITER` | 60 / 60 s | the public health probe |

Every 429 carries `Retry-After`. The failed-sign-in cap stops one IP guessing
many accounts; the lockout stops many IPs guessing one account. IPv6 clients
are counted per /64 (`ipKey`), since one client can rotate through a /64.

**CSRF:** better-auth checks `Origin` only inside its own router, which is not
mounted, so every cookie-authenticated POST runs `requireAllowedOrigin()`: an
`Origin` that is not in `FRONTEND_URLS` gets `forbidden_origin` (403). Add it to
any new state-changing route behind `requireAuth()`.

**Lockout details** (`auth-lockout.service.ts`):
- Key: the email, trimmed and lowercased. Unknown emails are counted and
  answered **exactly** like known ones (same 401 body, same 429), so the
  answers do not reveal which emails have accounts.
- One atomic upsert per failure (concurrent failures cannot lose a count); a
  successful sign-in deletes the row. The count restarts only 15 minutes after
  the last failure, so failures cannot be split across a window edge (a guesser
  slower than one try per 15 minutes is locked too: stricter, on purpose). Honest traffic: one D1 read per sign-in,
  no write.
- Locked → `auth_account_locked` (429) + `Retry-After` in seconds, for API
  clients. The user never sees the wait (board, 2026-10-24, all products):
  every 429 on sign-in or sign-up (lockout, failed-sign-in cap, rate limit)
  shows "Too many attempts. Try again later." in the app's language and copy
  style. No minutes, seconds or countdown, and the client does not build copy
  from `Retry-After`.
- Sign-up answers `email_taken` (409) for a registered email: that does tell
  which emails have accounts, accepted for usable sign-up; it sits behind the
  `auth` rate-limit tier. Sign-in never tells.
- **Password reset stays outside the lockout** when a project adds it, so an
  attacker can at worst lock a real user out for 15 minutes, never for good.

**D1 cost of rule 3:** one `getSession` per authenticated request, a lookup
by the unique session token plus the user row. Count it against the 5 million
rows read/day of the free plan above; check the real number in the D1 dashboard
(Metrics → rows read) once a project has traffic, and tell the CTO before it
gets near the limit. Nothing here may move to a paid plan without the CEO.

**Config:** `BETTER_AUTH_SECRET` (32+ random chars per environment, a GitHub
Environment secret created by the Head of Platform; `deploy.yml` lists it as
`SECRET_BETTER_AUTH_SECRET`). `baseURL` is the first `FRONTEND_URLS` origin;
`trustedOrigins` is `FRONTEND_URLS`, plus localhost/LAN only in dev
(`network-policy.ts`; the callback returns `[]` when better-auth probes it with
no request at init). The better-auth instance is cached per isolate by the
`Db` handle: building it per request costs CPU.

## Client (template paths)

| Piece | Path |
|---|---|
| Session cache (localStorage) | `apps/web/src/data/auth/session-cache.ts` |
| `useSession` (SWR), `fetchSession` | `apps/web/src/data/auth/queries.ts` |
| `useSignIn`, `useSignUp`, `useSignOut`, `authErrorMessage` | `apps/web/src/data/auth/mutations.ts` |
| 401 → clear + redirect | `apps/web/src/data/backend-client.ts` (`apiFetch`), `src/data/auth/unauthorized.ts`, `src/components/auth/unauthorized-redirect.tsx` |
| Guard for protected pages | `apps/web/src/routing/layouts/authenticated.layout.tsx` (`_authenticated`) |

Rules the code and tests enforce:
1. **Cache only the summary:** `userId`, `name`, `expiresAt`. Never a token,
   never an email or other private data. Private data always comes from the API.
2. **Expired cached session → deny at once**, no waiting for the API.
3. **Live cached session → render at once and revalidate in the background**
   (the query's initial data is the cache, born stale).
4. **Any 401 from a non-auth API call → clear the cache and go to sign-in**
   (`apiFetch` → `onUnauthorized` handler). A 401 from `/api/v1/auth/*` is that
   route's own answer: the session query turns it into "signed out" and clears
   the cache; the guard then redirects if the page is protected.
5. **Sign-out clears the cache** even if the call fails.
6. A 503 is not "signed out": the cached session stays.

Every page that needs a session goes under the `_authenticated` layout in
`src/routing/config.ts`. Public pages may read `useSession()` for display and
never redirect.

## Tests that prove the standard

Keep them green in every project; port them when adopting the standard.

- Backend (`auth.routes.test.ts`, real worker, D1 and bindings from miniflare):
  revoked session → next call 401; sign-out → old cookie 401; 6th sign-in
  from one IP in 10 s → 429 + `Retry-After`; 5 wrong passwords from 5 IPs →
  6th is 429 with the right password; unlock after 15 min; failures split
  around the window edge still lock; unknown email identical to a known one;
  renewed cookie forwarded; foreign-origin POST → 403; no token in any body;
  cookie is `HttpOnly`.
- `password-hash.test.ts`: a hash made by the old custom function verifies
  with better-auth's default; new hashes keep the `salt:key` format.
- `rate-limit.test.ts`: both auth bindings must pass; failed-sign-in cap and
  cooldown.
- Client: `session-cache.test.ts`, `queries.test.tsx`,
  `authenticated.layout.test.tsx`, `unauthorized-redirect.test.tsx`,
  `backend-client.test.ts`, `sign-in.page.test.tsx`.

## Adding auth to an older repo

Copy the files in the two tables above, then: add the tables with an additive
migration (keep existing better-auth tables and hashes), remove any custom
password hash and any `cookieCache`, set `rateLimit: { enabled: false }`, add
the `[[ratelimits]]` stanzas per env with unique `namespace_id`s, and port the
tests. Repo-specific extras (OAuth providers, the admin plugin, bearer tokens
for a separate-origin app) stay, as long as rules 1–6 hold.
