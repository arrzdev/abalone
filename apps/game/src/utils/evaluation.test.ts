import {
  createGameState,
  resignGame,
} from "@repo/abalone-engine/game-state"
import { describe, expect, it } from "vitest"
import { barFraction, DECIDED, evaluateBoard } from "@/utils/evaluation"

//the evaluation bar is read from black's side: positive favours black.

describe("evaluateBoard", () => {
  it("reads as level when there is no game yet", () => {
    expect(evaluateBoard(null)).toBe(0)
  })

  it("reads as level on the opening position", () => {
    expect(evaluateBoard(createGameState("standard"))).toBeCloseTo(0, 10)
  })

  it("favours the side that is a marble ahead", () => {
    const opening = createGameState("standard")

    const blackAhead = createGameState("standard")
    const firstWhite = [...blackAhead.white][0]
    blackAhead.white.delete(firstWhite)

    const whiteAhead = createGameState("standard")
    const firstBlack = [...whiteAhead.black][0]
    whiteAhead.black.delete(firstBlack)

    expect(evaluateBoard(blackAhead)).toBeGreaterThan(
      evaluateBoard(opening),
    )
    expect(evaluateBoard(blackAhead)).toBeGreaterThan(0.5)
    expect(evaluateBoard(whiteAhead)).toBeLessThan(-0.5)
  })

  it("reports the result of a finished game rather than the board", () => {
    //white resigns while black has lost a marble: the scoreboard wins
    const state = createGameState("standard")
    state.black.delete([...state.black][0])
    const resigned = resignGame(state, "white")

    expect(resigned.winner).toBe("black")
    expect(evaluateBoard(resigned)).toBe(DECIDED)
  })

  it("reports a white win as the far end of the bar", () => {
    const state = createGameState("standard")
    state.white.delete([...state.white][0])
    const resigned = resignGame(state, "black")

    expect(resigned.winner).toBe("white")
    expect(evaluateBoard(resigned)).toBe(-DECIDED)
  })

  it("keeps reading the board when a finished game has no winner", () => {
    const drawn = { ...createGameState("standard"), gameOver: true }

    expect(drawn.winner).toBeNull()
    expect(evaluateBoard(drawn)).toBeCloseTo(0, 10)
  })
})

describe("barFraction", () => {
  it("sits in the middle of the bar for an even game", () => {
    expect(barFraction(0)).toBe(0.5)
  })

  it("fills the bar exactly for a decided game", () => {
    expect(barFraction(DECIDED)).toBeCloseTo(1, 10)
    expect(barFraction(-DECIDED)).toBeCloseTo(0, 10)
  })

  it("does not run off the ends for scores beyond a decided game", () => {
    expect(barFraction(100)).toBe(barFraction(DECIDED))
    expect(barFraction(-100)).toBe(barFraction(-DECIDED))
  })

  it("is the mirror image for the other side", () => {
    for (const score of [0.2, 1, 2.5, 5]) {
      expect(barFraction(score) + barFraction(-score)).toBeCloseTo(1, 10)
    }
  })

  it("never moves back as black's lead grows", () => {
    let previous = barFraction(-DECIDED)
    for (let score = -DECIDED + 0.5; score <= DECIDED; score += 0.5) {
      expect(barFraction(score)).toBeGreaterThan(previous)
      previous = barFraction(score)
    }
  })

  it("spends more of the bar on small margins than a straight line would", () => {
    //half a marble on a linear -6..6 bar is about 4% of the half-bar
    const linear = 0.5 + 0.5 * (0.5 / DECIDED)

    expect(barFraction(0.5)).toBeGreaterThan(linear + 0.02)
  })
})
