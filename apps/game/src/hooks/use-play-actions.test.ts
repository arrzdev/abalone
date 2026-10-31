import { PLAYABLE_SETUPS } from "@repo/abalone-engine/board-setups"
import { createGameState } from "@repo/abalone-engine/game-state"
import { describe, expect, it } from "vitest"
import { COMPUTER_GAME, computerGameOn } from "@/hooks/use-play-actions"

//the starting positions page offers a game on each layout it draws: the same
//route and search as any computer game (so it is counted as one), with the
//layout asked for beside the request to start on the board.
describe("computerGameOn", () => {
  it.each(["standard", "belgian_daisy", "german_daisy"] as const)(
    "goes where the computer game goes, asking for %s",
    (setup) => {
      const game = computerGameOn(setup)
      expect(game.to).toBe(COMPUTER_GAME.to)
      expect(game.search).toEqual(COMPUTER_GAME.search)
      expect(game.state).toEqual({ startOnBoard: true, setup })
    },
  )

  it.each(PLAYABLE_SETUPS)("%s opens with 14 marbles a side", (setup) => {
    const { black, white, setupType } = createGameState(
      setup,
      "black",
      "ai",
    )
    expect(setupType).toBe(setup)
    expect(black.size).toBe(14)
    expect(white.size).toBe(14)
  })

  it("leaves the plain computer game on the default layout", () => {
    expect(COMPUTER_GAME.state).toEqual({ startOnBoard: true })
  })
})
