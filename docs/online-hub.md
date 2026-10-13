# Online hub: one live card per game

The online hub (`/online`) shows every game as the same board card and keeps
itself current while the page is open.

## The card

Every game is one card: the active games waiting on you, the ones waiting on
the other player, and the finished preview. The plain avatar row is gone from
the hub. The history page (`/online/history`) keeps its rows.

| Part | What it shows | Source |
|---|---|---|
| Board | Position thumbnail (`BoardThumb`) | `blackCells`, `whiteCells` |
| Opponent | Avatar and name | `opponent.name`, `opponent.avatarUrl` |
| Turn | "Your move" (accent colour, bold) / "Their move" (muted, regular) / the result once finished ("Won", "Lost", "Draw") | `currentTurn`, my seat, `status`, `winner` |
| Last move | "Last move 5 min ago", or "No moves yet" | `updatedAt`, `moveCount` |
| Started | "Started 3 Oct" | `createdAt` |
| Score | `mine–theirs`, the leading side's number bold | `blackScore`, `whiteScore` |

- The readings come from one function, `gameCardOf(game, myUserId)` in
  `apps/game/src/utils/game-card.ts`. The card only lays them out.
- Markup hooks: each card carries `data-game-card` and
  `data-turn="mine|theirs|over"`. Styling keys off `data-turn`, not class
  ternaries.
- Relative times tick once a minute while the hub is open.
- Order: "Your move" cards first (longest waiting first), then "Their move"
  (latest first), then the finished preview. Grouping stays in
  `utils/hub-groups.ts`.

## Live updates: realtime beacon, data through the API

The realtime socket already exists: one `PubSub` Durable Object per user
(`user:<id>`), opened app-wide by `RealtimeProvider`. Every move and
resignation sends `game-updated { gameId, updatedAt }` to both seats. No
change to the Durable Object or the protocol.

On `game-updated`, `applyRealtimeEvent` also updates the hub lists:

1. Skip if this device is writing to that game (existing guard) or the active
   list already shows that version (`updatedAt`).
2. If the active list is cached and has the game: fetch `GET /api/v1/games/:id`
   once and replace that entry in `onlineKeys.games("active")` in place. If the
   answer is finished, remove it from the active list and put it first in
   `onlineKeys.games("finished")` (when that list is cached).
3. If the active list is cached and lacks the game: invalidate the active list.
4. If no list is cached, do nothing for the lists.

The beacon never carries game data; the API answer is the only source.
Polling stays as the fallback when the socket is down (15 s).

Why not polling only: the socket and the beacons are already there, so the
cost is one function in the client, and a move shows on the hub at once instead
of after up to 15 s.

## API change: one name per player

`PlayerSummary` (games and invites) gets one name field:

```ts
type PlayerSummary = {
  userId: string
  name: string          // the handle as the player typed it: displayUsername ?? username
  avatarUrl: string | null
}
```

Expand and contract, because installed clients still read the old fields:

1. Expand (this change): add `name`; `username` and `displayUsername` stay,
   marked `BACKWARD_COMPAT`. The game reads only `name`.
2. Contract (follow-up, after the expand is deployed): drop `username` and
   `displayUsername` from `PlayerSummary`.

Account fields (`/auth`, profile) keep `username` and `displayUsername`: those
are the account, not the player envelope.

## Tests

- API: `apps/backend/src/http/routes/game.routes.test.ts`, "how a player is
  named".
- Cache update: `apps/game/src/data/realtime/invalidate.test.ts`, "on the
  hub's lists".
- Card states: `apps/game/src/utils/game-card.test.ts`.
- E2E: `e2e/online-hub.spec.ts` (card on both seats, live flip after a move).
