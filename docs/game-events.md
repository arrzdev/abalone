# Game events

How many games are played, in which mode, and how many reach an end. One row per
game started and one per game finished, in the D1 table `game_events`. Nothing
in it names a player, a device or an address.

## What is stored

| Column | Holds |
|---|---|
| `id` | random uuid of the row |
| `game_ref` | random uuid of the game, so a start and its finish pair up. Made on the device for `ai` and `local`; never derived from a user, a device or the online game's id |
| `kind` | `start` or `finish` |
| `mode` | `ai`, `local` or `online` |
| `bot_level` | 1 to 8 for `ai`, null otherwise |
| `result` | finish only. `ai`: `win`, `loss`, `draw`, `abandoned`, from the human's side. `local` and `online`: the winner `black` or `white`, or `draw`; `local` can also be `abandoned` |
| `move_count` | finish only: plies played |
| `guided` | start only: 1 when the first-game guide is showing as the game starts, 0 otherwise. Always 0 for finishes, `online` rows, and starts from builds older than the flag |
| `app_version` | the build that sent it; `server` for `online` rows |
| `created_at` | epoch ms, set by the server |

No user id, IP, user agent or cookie, ever. The rate limit counts by IP in
worker memory only and never writes it.

## Who writes which mode

- **`ai` and `local`**: the game, through `POST /api/v1/events/game` (no auth,
  204). A start when a game begins; a finish when it ends, or `abandoned` when the
  player starts another game or leaves the page mid-game. Sent with
  `navigator.sendBeacon`, falling back to `fetch` with `keepalive`; any failure is
  swallowed. A start also says `guided: true|false`: whether the first-game
  guide ([first-game-guide.md](first-game-guide.md)) is showing as the game
  begins, read from the saved flag at that moment. "How to move" later in the
  same game does not change a start already sent. A finish never carries it;
  it pairs with its start by `game_ref`.
- **`online`**: the backend, from the game routes: a start when an invite is
  accepted, a finish when a move or a resignation ends the game. The route
  refuses `mode: "online"`, so an online game is never counted twice.
  Online refs are a fresh random uuid per event, not the game id: the id would
  join the row back to `games`, which names both players. So online starts and
  finishes do not pair; count them instead. An online game that is never
  finished stays `active` and gets no finish row.

**Offline:** events are dropped, not queued. The numbers are for trends, not
billing, and a queue would be one more thing that can break the game.

## Reading it

```sh
pnpm --filter @repo/backend exec wrangler d1 execute abalone-backend-db --remote --env production --command "<sql>"
```

Games started and finished per mode per day:

```sql
select date(created_at / 1000, 'unixepoch') as day, mode,
       sum(kind = 'start') as started,
       sum(kind = 'finish' and result != 'abandoned') as finished
from game_events
group by day, mode
order by day desc, mode;
```

Bot level split, with the human's results:

```sql
select bot_level,
       sum(kind = 'start') as started,
       sum(result = 'win') as wins,
       sum(result = 'loss') as losses,
       sum(result = 'abandoned') as abandoned
from game_events
where mode = 'ai'
group by bot_level
order by bot_level;
```

Finish rate per mode, last 30 days (counted, so it works for `online` too):

```sql
select mode,
       sum(kind = 'start') as started,
       sum(kind = 'finish' and result != 'abandoned') as finished,
       round(100.0 * sum(kind = 'finish' and result != 'abandoned')
             / max(sum(kind = 'start'), 1), 1) as finish_rate_pct
from game_events
where created_at >= (strftime('%s', 'now') - 30 * 86400) * 1000
group by mode;
```

First games that reach a player move, before and after the guide. A game
"reaches a player move" when its finish (any result, `abandoned` included) has
at least one ply from a person: 1 in `local`, 2 in `ai` (the bot may open). A
start with no finish counts as no move: the tab was closed before it could say.

Rows before the guide cannot tell a first game from any other, so `before` is
every offline start in the 30 days before the guide went live (replace
`:guide_live_ms` with its production deploy time, epoch ms). `guided` and
`unguided` start at the first guided row, so the gap between the guide going
live and the flag going live (guided games stored as 0) is left out.

```sql
with
  flag_live as (
    select min(created_at) as at from game_events where guided = 1
  ),
  starts as (
    select game_ref,
           case
             when created_at < :guide_live_ms then 'before'
             when created_at >= (select at from flag_live) and guided = 1
               then 'guided'
             when created_at >= (select at from flag_live) then 'unguided'
           end as cohort
    from game_events
    where kind = 'start' and mode in ('ai', 'local')
      and created_at >= :guide_live_ms - 30 * 86400 * 1000
  ),
  moved as (
    select game_ref from game_events
    where kind = 'finish' and mode in ('ai', 'local')
      and move_count >= case mode when 'ai' then 2 else 1 end
  )
select cohort,
       count(*) as started,
       sum(game_ref in (select game_ref from moved)) as reached_a_move,
       round(100.0 * sum(game_ref in (select game_ref from moved))
             / count(*), 1) as reached_a_move_pct
from starts
where cohort is not null
group by cohort;
```

Compare `guided` with `before`. `unguided` is everyone who already finished or
skipped the guide, so it is a returning-player baseline, not a control group.
