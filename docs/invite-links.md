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
  game of Abalone". Chat apps that do not run JavaScript still see the root card:
  the game is one prerendered SPA shell. A per-link card needs a request-time
  head and is a separate decision.
- All copy goes through `core-copywriting`, in every locale under
  `apps/game/src/i18n/locales`.

## Tests

- API: `apps/backend/src/http/routes/invite-link.routes.test.ts`.
- Return path through sign-up: `apps/game/src/routing/return-to.test.ts`.
- E2E: `e2e/invite-link.spec.ts` (two browser contexts; used and expired links).
  `e2e/support/database.ts` moves a link's expiry into the past in the e2e D1.
