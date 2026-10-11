# First-game guide

A first-time visitor's first offline game (vs Computer or Pass & Play) shows a
three-step guide on the real board. Online games never show it. Frontend only:
no route, no table.

## Steps

| # | Step | Moves on when |
|---|------|---------------|
| 1 | `select`: pick 1 to 3 marbles in a line | the board has at least one marble selected, or Next |
| 2 | `direction`: choose where they go | a move lands, or Next. Letting go of every marble goes back to step 1 |
| 3 | `win`: push 6 off to win | Got it (the Next of the last step) |

Skip is on every step. A move that lands while still on step 1 jumps to step 3.
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

## Settings: How to move

A button in the Settings sheet. It clears the flag (`resetGuide`), closes the
sheet, and shows the guide at step 1 on the game in progress. Anywhere else it
shows on the next offline game.

## Layout

The guide is a labelled region (`<section aria-label>`), not a modal: no
backdrop, no focus trap, and it never covers the board, so the presses it
teaches reach the board. It sits in the page's own flow (the side panel on
desktop, the space below the board on a phone), inside the viewport contract of
`stack-ui-shell`, with no fixed positioning of its own.

## Tests

- Unit: `apps/game/src/utils/first-game-guide.test.ts` (step logic, flag, no storage).
- e2e: `e2e/first-game-guide.spec.ts` (fresh storage shows it, finish and skip
  are saved, second game has none, How to move brings it back, German copy, the
  guide never overlaps the board).

## Later

`guided: boolean` on the game start event, once game events (TUD-629) are
merged, to compare first games with at least one player move before and after.
