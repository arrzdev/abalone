import { describe, expect, it } from "vitest"
import {
  applyMove,
  deselectMarble,
  directionBetween,
  formsLine,
  getPossibleMoves,
  marbleAt,
  selectMarble,
  selectRun,
  shiftNames,
} from "#abalone-engine/rules"
import type { Board } from "#abalone-engine/types"

function boardOf(black: string[], white: string[]): Board {
  return { black: new Set(black), white: new Set(white) }
}

describe("reading the board", () => {
  it("says which side stands on a square", () => {
    const board = boardOf(["0,0"], ["0,1"])
    expect(marbleAt(board, "0,0")).toBe("black")
    expect(marbleAt(board, "0,1")).toBe("white")
    expect(marbleAt(board, "1,0")).toBeNull()
  })

  it("gives the step between neighbours and null otherwise", () => {
    expect(directionBetween("0,0", "0,1")).toEqual([0, 1])
    expect(directionBetween("0,0", "-1,1")).toEqual([-1, 1])
    expect(directionBetween("0,0", "0,2")).toBeNull()
    expect(directionBetween("0,0", "9,9")).toBeNull()
  })

  it("shifts named squares by a step, on or off the board", () => {
    expect(shiftNames(["0,3", "0,4"], [0, 1])).toEqual(["0,4", "0,5"])
  })
})

describe("formsLine", () => {
  it("passes anything up to a pair and vets triples", () => {
    expect(formsLine(["0,0"])).toBe(true)
    expect(formsLine(["0,0", "0,1"])).toBe(true)
    expect(formsLine(["0,2", "0,0", "0,1"])).toBe(true)
    expect(formsLine(["0,0", "0,1", "1,1"])).toBe(false)
    expect(formsLine(["0,0", "0,1", "0,2", "0,3"])).toBe(false)
    expect(formsLine(["0,0", "0,1", "9,9"])).toBe(false)
  })
})

describe("selectMarble", () => {
  const board = boardOf(["0,0", "0,1", "0,2", "1,0", "-4,0"], ["0,3"])

  it("grows a line along its axis", () => {
    expect(selectMarble(board, [], "0,0", "black")).toEqual(["0,0"])
    expect(selectMarble(board, ["0,0"], "0,1", "black")).toEqual([
      "0,0",
      "0,1",
    ])
    expect(selectMarble(board, ["0,0", "0,1"], "0,2", "black")).toEqual([
      "0,0",
      "0,1",
      "0,2",
    ])
  })

  it("starts over on the wrong colour, a far marble, a bend or a fourth", () => {
    expect(selectMarble(board, ["0,2"], "0,3", "white")).toEqual(["0,3"])
    expect(selectMarble(board, ["0,0"], "-4,0", "black")).toEqual(["-4,0"])
    expect(selectMarble(board, ["0,0", "0,1"], "1,0", "black")).toEqual([
      "1,0",
    ])
    expect(
      selectMarble(board, ["0,0", "0,1", "0,2"], "1,0", "black"),
    ).toEqual(["1,0"])
  })
})

describe("deselectMarble", () => {
  it("drops an end of the selection", () => {
    expect(deselectMarble(["0,0", "0,1", "0,2"], "0,2")).toEqual([
      "0,0",
      "0,1",
    ])
  })

  it("restarts from the middle rather than leave a gapped pair", () => {
    expect(deselectMarble(["0,0", "0,1", "0,2"], "0,1")).toEqual(["0,1"])
  })
})

describe("selectRun", () => {
  const board = boardOf(["0,0", "0,1", "0,2", "0,3"], ["1,0"])

  it("selects every marble between the two ends", () => {
    expect(selectRun(board, "0,0", "0,0")).toEqual(["0,0"])
    expect(selectRun(board, "0,0", "0,2")).toEqual(["0,0", "0,1", "0,2"])
    expect(selectRun(board, "0,2", "0,0")).toEqual(["0,2", "0,1", "0,0"])
  })

  it("returns null for runs that are too long, bent or mixed", () => {
    expect(selectRun(board, "0,0", "0,3")).toBeNull()
    expect(selectRun(board, "0,0", "1,1")).toBeNull()
    expect(selectRun(board, "0,1", "1,0")).toBeNull()
    expect(selectRun(board, "1,1", "0,0")).toBeNull()
    expect(selectRun(board, "0,0", "9,9")).toBeNull()
  })
})

describe("getPossibleMoves", () => {
  it("offers nothing for no selection, unknown squares or a broken line", () => {
    const board = boardOf(["0,0", "0,2"], [])
    expect(getPossibleMoves(board, null, true)).toEqual([])
    expect(getPossibleMoves(board, [], true)).toEqual([])
    expect(getPossibleMoves(board, ["9,9"], true)).toEqual([])
    expect(getPossibleMoves(board, ["0,0", "0,2"], true)).toEqual([])
  })

  it("lets the side to move push, judged from that side", () => {
    const board = boardOf(["0,1"], ["0,-1", "0,0"])
    expect(getPossibleMoves(board, ["0,0", "0,-1"], false)).toContain(
      "0,1",
    )
  })
})

describe("applyMove", () => {
  it("reports a capture, its score and the marble's flight off the board", () => {
    const board = boardOf(["0,2", "0,3"], ["0,4", "-4,0"])
    const outcome = applyMove(board, ["0,2", "0,3"], "0,4", true)

    expect(outcome?.board.black).toEqual(new Set(["0,3", "0,4"]))
    expect(outcome?.board.white).toEqual(new Set(["-4,0"]))
    expect(outcome?.blackScoreDelta).toBe(1)
    expect(outcome?.whiteScoreDelta).toBe(0)
    expect(outcome?.isPush).toBe(true)
    expect(outcome?.isCapture).toBe(true)
    expect(outcome?.direction).toEqual([0, 1])
    expect(outcome?.shovedMarbles).toEqual(["0,4"])
    expect(outcome?.movingMarbles).toContainEqual({
      from: "0,4",
      to: "0,5",
      color: "#fff",
    })
  })

  it("credits white's captures to white", () => {
    const board = boardOf(["0,4"], ["0,2", "0,3"])
    const outcome = applyMove(board, ["0,2", "0,3"], "0,4", false)
    expect(outcome?.whiteScoreDelta).toBe(1)
    expect(outcome?.blackScoreDelta).toBe(0)
  })

  it("reports a broadside as a plain move", () => {
    const board = boardOf(["0,0", "0,1"], [])
    const outcome = applyMove(board, ["0,0", "0,1"], "1,1", true)
    expect(outcome?.board.black).toEqual(new Set(["1,0", "1,1"]))
    expect(outcome?.isPush).toBe(false)
    expect(outcome?.marbleCount).toBe(2)
  })

  it("returns null for an empty selection, unknown squares or no contact", () => {
    const board = boardOf(["0,0"], [])
    expect(applyMove(board, [], "0,1", true)).toBeNull()
    expect(applyMove(board, ["0,0"], "9,9", true)).toBeNull()
    expect(applyMove(board, ["9,9"], "0,1", true)).toBeNull()
    expect(applyMove(board, ["0,0"], "0,2", true)).toBeNull()
  })

  it("returns null for a move that would walk off the board", () => {
    const board = boardOf(["0,3", "0,4"], [])
    expect(applyMove(board, ["0,3", "0,4"], "0,4", true)).toBeNull()
  })
})
