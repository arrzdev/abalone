import { describe, expect, it } from "vitest"
import { DEMO_GAME } from "#abalone-engine/demo-game"
import {
  createGameState,
  isBlackTurn,
  makeMove,
} from "#abalone-engine/game-state"
import { getPossibleMoves } from "#abalone-engine/rules"

describe("DEMO_GAME", () => {
  it("is a legal game from the standard opening that ends three captures each", () => {
    let state = createGameState("standard", "black", "local")

    for (const [index, move] of DEMO_GAME.entries()) {
      const legal = getPossibleMoves(
        state,
        move.marbles,
        isBlackTurn(state),
      )
      expect(legal, `move ${index}`).toContain(move.to)
      state = makeMove(state, move.marbles, move.to).state
    }

    expect(state.blackScore).toBe(3)
    expect(state.whiteScore).toBe(3)
    expect(state.gameOver).toBe(false)
    expect(state.moveHistory).toHaveLength(DEMO_GAME.length + 1)
  })
})
