import { describe, expect, it } from "vitest"
import { formatMoveAlgebraic, squareLabel } from "#abalone-engine/notation"
import { ALL_CELLS, cellNames } from "#abalone-engine/topology"

describe("squareLabel", () => {
  it("labels the centre and the corners", () => {
    expect(squareLabel("0,0")).toBe("e5")
    expect(squareLabel("4,-4")).toBe("a1")
    expect(squareLabel("4,0")).toBe("a5")
    expect(squareLabel("-4,0")).toBe("i5")
    expect(squareLabel("-4,4")).toBe("i9")
  })

  it("gives every cell its own label, a letter a–i and a digit 1–9", () => {
    const labels = ALL_CELLS.map((cell) => squareLabel(cellNames[cell]))
    expect(new Set(labels).size).toBe(ALL_CELLS.length)
    for (const label of labels) expect(label).toMatch(/^[a-i][1-9]$/)
  })

  it("returns an empty label for a square that is not on the board", () => {
    expect(squareLabel("5,0")).toBe("")
    expect(squareLabel("")).toBe("")
  })
})

describe("formatMoveAlgebraic", () => {
  it("writes a single step as from-square then to-square", () => {
    expect(formatMoveAlgebraic(["0,0"], "0,1")).toBe("e5e6")
  })

  it("starts from the marble furthest from the destination, in any order", () => {
    const expected = "e3e6"
    expect(formatMoveAlgebraic(["0,-2", "0,-1", "0,0"], "0,1")).toBe(
      expected,
    )
    expect(formatMoveAlgebraic(["0,0", "0,-2", "0,-1"], "0,1")).toBe(
      expected,
    )
  })

  it("skips unknown squares after the first", () => {
    expect(formatMoveAlgebraic(["0,0", "9,9"], "0,1")).toBe("e5e6")
  })

  it("writes nothing for an empty or unreadable move", () => {
    expect(formatMoveAlgebraic([], "0,1")).toBe("")
    expect(formatMoveAlgebraic(["0,0"], "")).toBe("")
    expect(formatMoveAlgebraic(["0,0"], "9,9")).toBe("")
    expect(formatMoveAlgebraic(["9,9", "0,0"], "0,1")).toBe("")
  })
})
