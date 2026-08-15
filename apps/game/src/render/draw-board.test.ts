import type { GameState } from "@repo/abalone-engine/game-state"
import {
  createGameState,
  goToMove,
  makeMove,
} from "@repo/abalone-engine/game-state"
import type { CellName } from "@repo/abalone-engine/types"
import { describe, expect, it } from "vitest"
import type { BoardView } from "@/render/draw-board"
import { furrowsToShow } from "@/render/draw-board"

//the furrow is laid out in board pixels, and none of that is what is under
//test — only which side the ink is chosen for. any sane view will do.
const VIEW: BoardView = {
  centerX: 200,
  centerY: 200,
  radius: 16,
  spacing: 40,
  baseLineWidth: 1,
  width: 400,
  height: 400,
}

/** Plays the first legal single-marble move the side to move has. */
function playOneMove(state: GameState) {
  const movers = state.currentTurn === "black" ? state.black : state.white
  for (const marble of movers) {
    const [r, q] = marble.split(",").map(Number)
    for (const [dr, dq] of [
      [1, 0],
      [1, -1],
      [0, -1],
      [-1, 0],
      [-1, 1],
      [0, 1],
    ]) {
      const destination = `${r + dr},${q + dq}` as CellName
      const attempt = makeMove(state, [marble], destination)
      if (attempt.result) return { played: attempt.state, marble }
    }
  }
  throw new Error("no legal move to test with")
}

describe("furrowsToShow", () => {
  //the regression. a settled furrow reads the mover's colour off the board,
  //and it has to read it where the mover now stands. an online board never
  //replays a move — it maps the server's log and settles through `goToMove` —
  //so a `goToMove` that reported the squares the movers LEFT put a black
  //marble's trail in white ink and a white one's in black, on every move the
  //opponent made. the animation reads the marble itself and was always right,
  //which is what made it look like the trail changed colour on landing.
  it("inks a settled furrow for the side that moved", () => {
    const start = createGameState("standard", "black", "local")
    const { played } = playOneMove(start)

    const settled = furrowsToShow(VIEW, played)
    expect(settled).toHaveLength(1)
    expect(settled[0].onDark).toBe(true)

    //the same position arrived at the way an online board arrives at it
    const mapped = goToMove(played, played.currentMoveIndex)
    const remapped = furrowsToShow(VIEW, mapped)
    expect(remapped).toHaveLength(1)
    expect(remapped[0].onDark).toBe(true)
  })

  it("inks white's furrow for white", () => {
    const start = createGameState("standard", "black", "local")
    const { played: afterBlack } = playOneMove(start)
    const { played } = playOneMove(afterBlack)

    const mapped = goToMove(played, played.currentMoveIndex)
    expect(furrowsToShow(VIEW, mapped)[0].onDark).toBe(false)
  })

  it("draws nothing before anyone has moved", () => {
    const start = createGameState("standard", "black", "local")
    expect(furrowsToShow(VIEW, start)).toEqual([])
  })
})
