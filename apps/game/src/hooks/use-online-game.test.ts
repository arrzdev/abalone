import { describe, expect, it } from "vitest"
import type { Game, GameMove } from "@/data/online/queries"
import { toGameState } from "@/hooks/use-online-game"

//the board reads a game off two requests that arrive separately: the row, which
//is cheap and polled, and the plies, which are not. these are about the window
//between them, where the row already knows something the board cannot draw yet.

/** Only the fields `toGameState` actually reads. */
function row(overrides: Partial<Game>): Game {
  return {
    id: "3f7b1c60-0000-4000-8000-000000000001",
    setupType: "standard",
    status: "active",
    moveCount: 0,
    winner: null,
    finishReason: null,
    ...overrides,
  } as Game
}

/** The opening, which nobody moved into. */
const opening = {
  blackCells: ["-4,0", "-4,1"],
  whiteCells: ["4,-1", "4,0"],
  blackScore: 0,
  whiteScore: 0,
  currentTurn: "black",
  marbles: null,
  destination: null,
  direction: null,
  isPush: false,
  isCapture: false,
  shovedMarbles: [],
} as unknown as GameMove

/** One ply on from it, which black played. */
const ply = {
  blackCells: ["-3,0", "-4,1"],
  whiteCells: ["4,-1", "4,0"],
  blackScore: 0,
  whiteScore: 6,
  currentTurn: "white",
  marbles: ["-4,0"],
  destination: "-3,0",
  direction: { r: 1, q: 0 },
  isPush: false,
  isCapture: true,
  shovedMarbles: [],
} as unknown as GameMove

describe("toGameState", () => {
  //THE REGRESSION. the row is a round trip ahead of the plies, so a game the
  //opponent has just won reads as finished while the board is still showing the
  //position before the winning move. Believed then, the result goes up over that
  //position, comes down when the plies arrive and the move plays out, and goes
  //back up after it — the panel swapping to its postgame form and back, and the
  //modal blinking, over a board that has not moved.
  it("holds back an ending the move history has not reached", () => {
    const state = toGameState(
      row({ status: "finished", moveCount: 1, winner: "black" }),
      [opening],
      "black",
      null,
    )

    expect(state.gameOver).toBe(false)
    expect(state.winner).toBeNull()
    expect(state.gameOverReason).toBeNull()
  })

  it("reports the ending once the plies have caught up", () => {
    const state = toGameState(
      row({
        status: "finished",
        moveCount: 1,
        winner: "black",
        finishReason: "score",
      }),
      [opening, ply],
      "black",
      null,
    )

    expect(state.gameOver).toBe(true)
    expect(state.winner).toBe("black")
    expect(state.gameOverReason).toBe("score")
  })

  //a resignation ends a game without adding a ply, so the count on the row is
  //the one the history already holds. gating on the count rather than on the
  //status is what keeps this immediate while the other case waits.
  it("reports a resignation, which adds no move", () => {
    const state = toGameState(
      row({
        status: "finished",
        moveCount: 0,
        winner: "white",
        finishReason: "resignation",
      }),
      [opening],
      "black",
      null,
    )

    expect(state.gameOver).toBe(true)
    expect(state.winner).toBe("white")
  })

  it("leaves a game in progress alone", () => {
    const state = toGameState(
      row({ moveCount: 1 }),
      [opening, ply],
      "black",
      null,
    )

    expect(state.gameOver).toBe(false)
    expect(state.currentTurn).toBe("white")
    expect(state.currentMoveIndex).toBe(1)
  })
})
