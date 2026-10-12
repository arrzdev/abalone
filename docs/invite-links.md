# Invite links

A signed-in player makes a link and sends it anywhere: a chat, a text, a post.
The first other player who opens it and accepts plays them. Accounts stay
required: a friend without one signs up from the link and lands back on it.
Invite by username stays as it is.

## What is stored

D1 table `invite_links`, separate from `invites`: `invites.to_user_id` is
`NOT NULL`, and changing that in SQLite is a table rebuild. A new table is an
expand-only migration.

| Column | Holds |
|---|---|
| `id` | the token, and the secret in the URL: 32 random bytes (`crypto.getRandomValues`), base64url, no padding, 43 characters |
| `from_user_id` | the inviter, FK `user.id`, cascade on delete |
| `setup_type` | the board setup the inviter picked |
| `side` | `black`, `white` or `random`, for the inviter |
| `expires_at` | epoch ms, `created_at` + 7 days |
| `used_at` | epoch ms, null until accepted |
| `used_by_user_id` | the player who accepted, nullable FK `user.id` |
| `game_id` | the game it opened, nullable |
| `created_at` | epoch ms |

Index on `from_user_id`. `games` does not change: a game opened from a link
stores the link id in `games.invite_id`, which has no FK and is unique.

## API

All under `/api/v1`. Errors use the standard envelope.

| Route | Auth | Answers |
|---|---|---|
| `POST /invite-links` `{ setupType, side }` | yes | `201 { url, expiresAt }`. `url` is `<origin>/invite/<id>`, where origin is the request's `Origin` when it is in `FRONTEND_URLS`, else the first entry |
| `GET /invite-links/:id` | no | `200 { inviterName, state }`, state `open`, `used` or `expired`. Nothing else: no user id, terms, dates or game |
| `POST /invite-links/:id/accept` | yes | `201 { gameId }`; `200 { gameId }` with the same game when the player who already used it asks again |

| Code | Status | When |
|---|---|---|
| `unauthorized` | 401 | create or accept signed out |
| `invalid_input` | 400 | bad terms, or a malformed id |
| `not_found` | 404 | no link with that id |
| `invite_link_own` | 400 | the inviter accepts their own link. The link stays open |
| `invite_link_used` | 409 | someone else already accepted it |
| `invite_link_expired` | 410 | past `expires_at` and never used |
| `rate_limit_exceeded` | 429 | more than 20 creates or 20 accepts a minute from one IP (preset `invite-link`); the public read uses `api` |

`inviterName` is the inviter's `displayUsername`, falling back to `username`.

## Accepting is single-use

1. Claim: `UPDATE invite_links SET used_at = ?, used_by_user_id = ? WHERE id = ? AND used_at IS NULL AND expires_at > ? AND from_user_id <> ? RETURNING …`.
   One statement, so two racing accepts cannot both win.
2. No row back: read the row and answer `not_found`, `invite_link_own`,
   `invite_link_expired`, or `invite_link_used`. When `used_by_user_id` is the
   caller, it is a retry: continue to step 3 instead.
3. Open the game with `GameService.open({ inviteId: link.id, … })`, then set
   `game_id`. `games.invite_id` is unique, so a retry after a failure between
   the claim and the game finds the game already opened instead of making a
   second one.

Why not one D1 batch for the claim and the game insert: a batch cannot branch on
the rows the `UPDATE` changed, so the insert would run even when the claim lost.
The claim is the decision; the game write after it is idempotent. This also
keeps the link service and `GameService` apart, the same way
`InviteAcceptanceFacade` does (new facade: `InviteLinkAcceptanceFacade`).

After an accept, both players get `games-changed` on the realtime channel.

## Game app

- The invite composer on `/online` gets **Invite with a link** next to invite by
  username. It uses the side and setup chosen in the composer, then shows the
  link in a read-only field labelled **Invite link**, with **Share link**
  (Web Share API, where `navigator.share` exists) or **Copy link** (clipboard)
  otherwise.
- `/invite/$linkId` landing, public, reads `GET /invite-links/:id`:
  - open, signed out: "<name> invited you to a game of Abalone", **Create
    account** and **Sign in**. Both open the auth sheet with redirect
    `/invite/<id>`, so the player comes back to the same link (`return-to.ts`
    accepts `/invite/<43-char token>`).
  - open, signed in: the same heading and **Accept and play**, which calls
    accept and goes to `/online/<gameId>`.
  - open, inviter's own link: says it is their link and offers to share it again.
  - used or expired: "This invite has already been used" / "This invite has
    expired", one line on what to do, and a **Go home** link.
  - unknown id: the expired-style message with **Go home**.
- The page head (`pageHead`) uses the inviter's name from the public read, so
  share sheets and crawlers that run JavaScript see "<name> invited you to a
  game of Abalone". Chat apps that do not run JavaScript get the same card from
  the request-time head below.
- All copy goes through `core-copywriting`, in every locale under
  `apps/game/src/i18n/locales`.

## The link preview (TUD-799)

A link pasted into a chat app unfurls as "<name> invited you to a game of
Abalone" while it is open. Decision: Marta Reis (CTO), 2026-10-12.

**Where the head is rendered: the game Worker.** Every request for a path that
is not a static asset already reaches the game Worker (TanStack Start), which
writes the route head into the HTML it returns; `/invite/<id>` shows
"Invite · Abalone" today because the route's loader has no answer on the
server. A custom server entry (`apps/game/src/server.ts`, set with
`router.serverEntry` in `nativ.config.ts`, and as `main` in
`apps/game/wrangler.toml`: the Cloudflare plugin builds the Worker from `main`,
not from Start's server entry) wraps Start's handler:

1. `inviteLinkIdFromPath(pathname)` matches `/invite/<43-char token>`. Any
   other path goes to Start untouched.
2. Start renders the page as it does now (the shell).
3. The Worker calls the backend's public read, `GET /api/v1/invite-links/:id`:
   the existing route and `InviteLinkService`, one D1 query. No new route, no
   contract change, no D1 binding on the game Worker.
   - Production: a service binding `BACKEND` → `abalone-backend` in
     `[env.production]` of `apps/game/wrangler.toml`. A plain `fetch` to
     `abalone.tudu.dev/api/…` from the game Worker does not reach the backend:
     a subrequest to the same zone skips Worker routes.
   - Dev and e2e: no binding; the Worker fetches `VITE_BACKEND_URL`, which the
     e2e build already sets (`e2e/support/serve-game.sh`).
   - The request forwards the visitor's `cf-connecting-ip`, so the `api` rate
     limit keys on the visitor, not on the game Worker. A short timeout
     (about 1.5 s); past it, the generic card.
4. `serveInvitePage({ linkId, shell, readLink })`
   (`apps/game/src/server/invite-page.ts`) rewrites the head:

| Link | `<title>`, `og:title`, `twitter:title` | description (all three) | image |
|---|---|---|---|
| open | `<name> invited you to a game of Abalone` | `Accept and play <name> online. Abalone is the two-player strategy game where you push six of your opponent's marbles off the board.` | `og-game.jpg` |
| used, expired, unknown, read failed | `Invite · Abalone` | `An invite to a game of Abalone, the two-player strategy game of pushing marbles off the board.` | `og-home.jpg` |

- `twitter:card` stays `summary_large_image`, `robots` stays `noindex`. One
  fixed image per state; nothing is generated per link.
- The token never appears in the card text (title, descriptions). `og:url`
  keeps the link's own URL so a crawler that follows it gets the same card.
- The name is HTML-escaped: it goes into attributes.
- Every `/invite/<id>` response carries `Cache-Control: private, no-store`:
  the card changes when the link is used, so no edge or browser keeps it.
- The route's client head (`pages/invite-link.page.tsx`) uses the same copy
  (`fullTitle`, so the brand is not written twice), so the tab and the preview
  agree.

**Bots without JavaScript** read the HTML the Worker returns, which already has
the card; nothing depends on the client.

## Tests

- Link preview: `apps/game/src/server/invite-page.test.ts` (the four states,
  read failure, cache header, escaping, no token in the card text) and the
  "link preview" test in `e2e/invite-link.spec.ts` (raw HTML with a crawler user
  agent, open then used).
- API: `apps/backend/src/http/routes/invite-link.routes.test.ts`.
- Return path through sign-up: `apps/game/src/routing/return-to.test.ts`.
- E2E: `e2e/invite-link.spec.ts` (two browser contexts; used and expired links).
  `e2e/support/database.ts` moves a link's expiry into the past in the e2e D1.
