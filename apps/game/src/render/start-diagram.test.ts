import type { SetupKey } from "@repo/abalone-engine/board-setups"
import { BOARD_SETUPS } from "@repo/abalone-engine/board-setups"
import { CELL_COUNT, cellNames } from "@repo/abalone-engine/topology"
import { describe, expect, it } from "vitest"
import type { Diagram } from "@/render/draw-diagram"
import { diagramAspect } from "@/render/draw-diagram"
import { BELGIAN_DAISY, GERMAN_DAISY, START } from "@/render/start-diagram"

const named = (cells: [number, number][]) =>
  cells.map(([r, q]) => `${r},${q}`).sort()

/** The squares a diagram puts one side's marbles on. */
const squaresOf = (diagram: Diagram, side: "black" | "white") =>
  Object.entries(diagram.marbles ?? {})
    .filter(([, player]) => player === side)
    .map(([pos]) => pos)
    .sort()

const OPENINGS: [string, Diagram, SetupKey][] = [
  ["START", START, "standard"],
  ["BELGIAN_DAISY", BELGIAN_DAISY, "belgian_daisy"],
  ["GERMAN_DAISY", GERMAN_DAISY, "german_daisy"],
]

describe.each(OPENINGS)("%s", (_name, diagram, setup) => {
  it("draws every square of the board", () => {
    expect(diagram.cells).toHaveLength(CELL_COUNT)
    expect([...diagram.cells].sort()).toEqual([...cellNames].sort())
  })

  it(`sets out the ${setup} opening a game starts from`, () => {
    expect(squaresOf(diagram, "black")).toEqual(
      named(BOARD_SETUPS[setup].black),
    )
    expect(squaresOf(diagram, "white")).toEqual(
      named(BOARD_SETUPS[setup].white),
    )
  })

  it("gives each player 14 marbles", () => {
    expect(squaresOf(diagram, "black")).toHaveLength(14)
    expect(squaresOf(diagram, "white")).toHaveLength(14)
  })

  it("has no arrows or marks: it is a position, not a move", () => {
    expect(diagram.arrows ?? []).toEqual([])
    expect(diagram.marks ?? []).toEqual([])
  })

  //at 260px tall (RuleDiagram's cap) a square is about 19px across; the plate
  //on a 320 phone is 280px wide, so the board must be about as wide as tall
  it("is about as wide as it is tall", () => {
    expect(diagramAspect(diagram)).toBeGreaterThan(0.9)
    expect(diagramAspect(diagram)).toBeLessThan(1.3)
  })
})
