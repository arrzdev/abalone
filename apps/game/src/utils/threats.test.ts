import type { Board } from "@repo/abalone-engine/types"
import { describe, expect, it } from "vitest"
import { marblesAtRisk } from "@/utils/threats"

function board(black: string[], white: string[]): Board {
  return { black: new Set(black), white: new Set(white) }
}

//a rim square is only a rim square: 0,4 is the right-hand end of the middle
//row, so a line of black marbles pushing east shoves whatever stands there off

describe("marblesAtRisk", () => {
  it("names a marble on the rim that two pushers could shove off", () => {
    const risky = marblesAtRisk(board(["0,2", "0,3"], ["0,4"]), "white")

    expect([...risky]).toEqual(["0,4"])
  })

  it("is empty when the pushers are not strong enough", () => {
    //one against one is a stalemate, not a shove
    expect(marblesAtRisk(board(["0,3"], ["0,4"]), "white").size).toBe(0)
  })

  it("is empty when the marble has room behind it", () => {
    const risky = marblesAtRisk(board(["0,0", "0,1"], ["0,2"]), "white")

    expect(risky.size).toBe(0)
  })

  it("asks about the side given, and not the other one", () => {
    const position = board(["0,2", "0,3"], ["0,4"])

    expect(marblesAtRisk(position, "black").size).toBe(0)
  })

  it("finds the same danger for black when white is the one pushing", () => {
    const risky = marblesAtRisk(board(["0,-4"], ["0,-2", "0,-3"]), "black")

    expect([...risky]).toEqual(["0,-4"])
  })

  it("lists every marble in danger, not just the first", () => {
    const risky = marblesAtRisk(
      board(["0,2", "0,3", "2,-2", "3,-3"], ["0,4", "4,-4"]),
      "white",
    )

    expect([...risky].sort()).toEqual(["0,4", "4,-4"])
  })

  it("leaves the board it was given untouched", () => {
    const position = board(["0,2", "0,3"], ["0,4"])

    marblesAtRisk(position, "white")

    expect([...position.black]).toEqual(["0,2", "0,3"])
    expect([...position.white]).toEqual(["0,4"])
  })
})
