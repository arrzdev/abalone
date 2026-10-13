# First-game guide

A first-time visitor's first offline game (vs Computer or Pass & Play) shows a
three-step guide on the real board. Online games never show it. Frontend only:
no route, no table.

## Steps

| # | Step | Moves on when |
|---|------|---------------|
| 1 | `select`: pick 1 to 3 marbles in a line | the board has at least one marble selected (to step 2), or Next (to step 3) |
| 2 | `direction`: choose where they go | a move lands, or Next. Letting go of every marble goes back to step 1 |
| 3 | `win`: push 6 off to win | Got it (the Next of the last step) |

Skip is on every step. A move that lands while still on step 1 jumps to step 3.
Next on step 1 also jumps to step 3: step 2 talks about the spaces a selection
highlights, and after Next nothing is selected (TUD-852).
The guide also ends when the game it is shown on is over.

The step logic is one pure function, `advanceGuide(progress, event)` in
`apps/game/src/utils/first-game-guide.ts`, with events `selected { count }`,
`moved`, `next`, `skip`, `game_over`. The page feeds it from the game hook and
the board; nothing else decides which step is showing.

## Saved flag

- One versioned key: `abalone.guide.v1` = `done`. Any other value reads as not
  done. A later redesign of the guide bumps the version, which shows it once more.
- Finish, Skip or the end of the guided game writes it (`markGuideDone`).
- Storage that throws (private mode) never breaks the game: the flag is also
  kept in memory, so the guide shows at most once while the page is open.
- Read after mount, never during render. The pages are prerendered, and a flag
  read during the first render is a hydration mismatch (React #418).

## First game against the computer opens on the board

While the flag is not `done`, the ways in that offer a game against the
computer skip the setup screen and start the game at once: bot Gus (level 1),
the standard layout, the player on black, guide on step 1. Those are the setup
screen's own defaults, so nothing is chosen for the player that the screen
would not have chosen. Home → first move is 3 taps: vs Computer, a marble, a
highlighted space.

- Ways in: home "vs Computer", and the computer links on `/rules` and
  `/strategy` (intro link and play button on each).
- The link says "start now" in router history state (`state: { startOnBoard:
  true }`), not in the URL. The `href` stays `/offline`, which is what search
  engines see. A direct load of `/offline` (typed, bookmarked, from a search
  result) has no such state and shows the setup screen as before.
- `/offline` starts the game when that state is set and
  `startsOnBoard(mode, isGuideDone())` holds: mode `ai` and the guide not done.
  Pass & Play always keeps its setup screen (the names are asked there).
- Decided on entry only. Switching tabs on the setup screen later does not
  start a game.
- The setup screen never paints on the way: the page starts in play, not in
  setup and then in play.
- Exactly one `start` game event (mode `ai`, `botLevel: 1`, `guided: true`) per
  game started this way, also under React StrictMode.
- **New game** (existing copy `game:controls.new_game`) on the board during a
  game against the computer opens the setup screen in one tap. The game left
  behind is counted as `abandoned` (see `game-events.md`).
- After the flag is `done`, vs Computer opens the setup screen as before.

## The ? on the board: How to move

A small, quiet "?" in the top-right corner of the board area, just off the hex
(TUD-973). Its accessible name is "How to move"; the glyph is small (16 px or
less) but the target is 44×44, and no board space lies under it. It is not in
the action bar and not in Settings. It clears the flag (`resetGuide`) and shows
the guide at step 1 on the game in progress. Offline games only: the guide
never runs online, so neither does the ?.

## Layout

The guide is a labelled region (`<section aria-label>`), not a modal: no
backdrop, no focus trap, and it never covers the board, so the presses it
teaches reach the board. It sits in the page's own flow (the side panel on
desktop, the space below the board on a phone), inside the viewport contract of
`stack-ui-shell`, with no fixed positioning of its own.

On steps 1 and 2 the board is the action, so the guide has no filled button:
Skip and Next are text buttons (44×44 targets). Only Got it on step 3 may be
filled. On a phone and a desktop the card sits directly under the scoreboard
in the side panel (at most 24 px below the score row), above the move list and
the action bar. TUD-973 reverses TUD-852, which had moved it down the panel by
the starting marbles.

## Tests

- Unit: `apps/game/src/utils/first-game-guide.test.ts` (step logic, flag, no storage).
- e2e: `e2e/first-game-guide.spec.ts` (fresh storage shows it, finish and skip
  are saved, second game has none, the ? on the board brings it back, German copy, the
  guide never overlaps the board, no filled button on steps 1 and 2, Next on
  step 1 skips step 2, card directly under the scoreboard and the ? small in
  the board's top-right corner at 390x844 and 1440x900).
- e2e: `e2e/first-game-board.spec.ts` (first game opens on the board from home,
  `/rules` and `/strategy` at 390x844 and 1440x900, first move in 3 taps, one
  start event, New game opens the setup screen, guide done keeps the setup
  screen, Pass & Play keeps its setup screen).

## Later

`guided: boolean` on the game start event, once game events (TUD-629) are
merged, to compare first games with at least one player move before and after.
