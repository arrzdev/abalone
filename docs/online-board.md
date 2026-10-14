# Online board: how it takes state

The online board (`/online/$gameId`) shows one ply of the game at a time. It
gets to another ply in one way only: by playing a move from the ply on the
board, or by a deliberate cut. A move played on this device, the opponent's move
arriving, and a resync after the socket was down all go through that one path.

## Why

Before this, the board picked its picture each render from three sources: the
move this device had played (`pending`), the position held while an arriving
move played out (`replay`), and the state built from the server's row and plies.
A ref counted which ply had been shown and was written from four places, and a
timer gave up on slow animations. Each switch between sources replaced the whole
picture, so every new ordering of network answers, React commits and animation
frames was a new way to show the wrong picture for a frame: the flicker. Every
fix covered one ordering.

## The model

- **The server's log is the authority.** The row and the plies stay TanStack
  queries. The realtime beacon still only marks the row stale. Nothing here
  changes the API.
- **The board's ply is the one source of truth for the screen.** The board,
  the scores, the move list, whose turn it is and the result all read the shown
  ply. None of them read the queries directly, so the panel and the board
  always agree.
- **One step function decides what happens next**
  (`apps/game/src/utils/board-timeline.ts`, `nextBoardStep`). Its inputs: the
  shown ply, the last ply in the server's log, the move behind each ply, our
  own unconfirmed move, and whether anyone can watch an animation. Its answer is
  one of:
  - `idle`: nothing to do;
  - `play`: animate the next ply from the shown one, then show it;
  - `confirm`: the server has our move as we played it, so drop the optimistic
    ply and change nothing on screen;
  - `cut`: show a ply without animation.
- **A loop applies the steps** until the answer is `idle`, one animation at a
  time. Network answers only change the inputs. They decide when a ply is
  shown, never what is shown.

## Rules

1. The board never goes back to a ply it has left. A log older than the board
   is ignored. Reading the history back is a view on top of the board and
   changes nothing here.
2. A move played here is applied at once as an optimistic ply, through the same
   animation. When the server's log reaches that index, the same move is a
   `confirm` (no new picture). A different move there means the server wins
   (`cut`).
3. Behind by up to `MAX_REPLAYED_PLIES` (2), the plies play one by one, oldest
   first. Further behind, or with the tab hidden or animations off, it cuts.
4. A failed request does not take our move back. The answer may have been
   lost after the server played it, so the board asks for the row and keeps
   showing the move. If the server's log has the move, it is a `confirm` like
   any other. If the server says the move did not happen, the optimistic ply is
   marked refused and the board cuts back to the server's last ply, with the
   error. This is the only time the board moves back.
5. The game is over on screen when the shown ply is the server's last one and
   the row says finished.

## Tests

- Unit: `apps/game/src/utils/board-timeline.test.ts` (the step rules).
- E2E: `e2e/online-board-motion.spec.ts` reads the canvas pixels on every frame
  of both boards. Four moves in a row: the watching board shows the old
  position, then the marble sliding, then the new position, with no step back,
  and the board that moved holds its new position while the server confirms.
  Then a move whose answer is lost on the way back (the server plays it, the
  response is dropped): it lands once. Before this design it landed, went back
  to the old position and slid again.
