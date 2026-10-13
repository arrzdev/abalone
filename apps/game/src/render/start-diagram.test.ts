import { BOARD_SETUPS } from "@repo/abalone-engine/board-setups"
import { CELL_COUNT, cellNames } from "@repo/abalone-engine/topology"
import { describe, expect, it } from "vitest"
import { diagramAspect } from "@/render/draw-diagram"
import { START } from "@/render/start-diagram"

const named = (cells: [number, number][]) =>
  cells.map(([r, q]) => `${r},${q}`).sort()

/** The squares a diagram puts one side's marbles on. */
const squaresOf = (side: "black" | "white") =>
  Object.entries(START.marbles ?? {})
    .filter(([, player]) => player === side)
    .map(([pos]) => pos)
    .sort()

describe("START", () => {
  it("draws every square of the board", () => {
    expect(START.cells).toHaveLength(CELL_COUNT)
    expect([...START.cells].sort()).toEqual([...cellNames].sort())
  })

  it("sets out the standard opening the game starts from", () => {
    expect(squaresOf("black")).toEqual(named(BOARD_SETUPS.standard.black))
    expect(squaresOf("white")).toEqual(named(BOARD_SETUPS.standard.white))
  })

  it("has no arrows or marks: it is a position, not a move", () => {
    expect(START.arrows ?? []).toEqual([])
    expect(START.marks ?? []).toEqual([])
  })

  //at 260px tall (RuleDiagram's cap) a square is about 19px across; the plate
  //on a 320 phone is 280px wide, so the board must be about as wide as tall
  it("is about as wide as it is tall", () => {
    expect(diagramAspect(START)).toBeGreaterThan(0.9)
    expect(diagramAspect(START)).toBeLessThan(1.3)
  })
})
