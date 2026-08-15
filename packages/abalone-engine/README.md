# @repo/abalone-engine

The rules of Abalone, as a value. No DOM, no React, no I/O — a board goes in, a
board comes out, and the same code decides a move in the browser and on the
Worker that referees an online game.

## Layers

Two vocabularies for the same things, and the split is deliberate.

| | Below `rules.ts` | Above it |
| --- | --- | --- |
| a square | `CellId` — a dense integer, in `[0, 61)` | `CellName` — its axial coordinates, `"r,q"` |
| a colour | `Side` — `1` or `2` | `Player` — `"black"` or `"white"` |

The bottom half is what an inner loop wants: typed arrays it can index and a
64-bit position signature it can hash. The top half is what React wants: strings
it can put in a key and a move list can print. `rules.ts` is the only place the
two meet, and everything outside this package only ever sees the top half.

| | |
| --- | --- |
| `topology` | the 61-cell hex board: neighbours, headings, names |
| `position` | the packed position, and `signature` — the repetition key |
| `moves` | which lines can move, where to, and what a push costs |
| `rules` | the seam: named squares in, named squares out |
| `game-state` | the game as an immutable value, and every transition on it |
| `board-setups` | the ten openings, read from ASCII diagrams |
| `notation` | algebraic labels for the move list |
| `config` | 14 marbles a side, 6 to win, 3 to a line |
| `demo-game` | the self-playing board on the home screen |

## Using it

Every module is its own export — there is no barrel.

```ts
import { createGameState, makeMove } from "@repo/abalone-engine/game-state"
import type { Player } from "@repo/abalone-engine/types"
```

Nothing here mutates its arguments, including the arrays and sets inside a
`GameState`. A snapshot pulled out of `moveHistory` stays true forever, which is
what lets the move list step back through a game and what lets the server store
one ply per row.
