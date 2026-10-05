import { describe, expect, it } from "vitest"
import {
  MARBLES_PER_SIDE,
  MAX_LINE,
  SURVIVORS_AT_DEFEAT,
  WINNING_SCORE,
} from "#abalone-engine/config"

describe("config", () => {
  it("holds the standard rules: 14 a side, 6 to win, 3 to a line, 8 left is out", () => {
    expect(MARBLES_PER_SIDE).toBe(14)
    expect(WINNING_SCORE).toBe(6)
    expect(MAX_LINE).toBe(3)
    expect(SURVIVORS_AT_DEFEAT).toBe(MARBLES_PER_SIDE - WINNING_SCORE)
    expect(SURVIVORS_AT_DEFEAT).toBe(8)
  })
})
