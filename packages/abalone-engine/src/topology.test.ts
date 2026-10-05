import { describe, expect, it } from "vitest"
import {
  ALL_CELLS,
  CELL_COUNT,
  cellAt,
  cellCol,
  cellNamed,
  cellNames,
  cellRimHeading,
  cellRing,
  cellRow,
  HEADING_STEPS,
  HEADINGS,
  headingBetween,
  NOWHERE,
  nameBeyond,
  nameOf,
  neighbour,
  RIM,
  reverse,
  separation,
  veer,
} from "#abalone-engine/topology"

function neighbourCount(cell: number): number {
  let count = 0
  for (let heading = 0; heading < HEADINGS; heading++) {
    if (neighbour(cell, heading) !== NOWHERE) count++
  }
  return count
}

describe("board shape", () => {
  it("has 61 cells, each with a unique name that maps back to it", () => {
    expect(ALL_CELLS).toHaveLength(CELL_COUNT)
    expect(new Set(cellNames).size).toBe(CELL_COUNT)
    for (const cell of ALL_CELLS) {
      expect(cellNamed(nameOf(cell))).toBe(cell)
    }
  })

  it("puts 6k cells on ring k and one in the centre", () => {
    const perRing = [0, 0, 0, 0, 0]
    for (const cell of ALL_CELLS) perRing[cellRing[cell]]++
    expect(perRing).toEqual([1, 6, 12, 18, 24])
    expect(cellRing[cellNamed("0,0")]).toBe(0)
  })

  it("gives the centre six neighbours, a corner three and an edge four", () => {
    expect(neighbourCount(cellNamed("0,0"))).toBe(6)
    expect(neighbourCount(cellNamed("-4,0"))).toBe(3)
    expect(neighbourCount(cellNamed("4,-4"))).toBe(3)
    expect(neighbourCount(cellNamed("-4,1"))).toBe(4)
  })

  it("counts 6 corners and 18 edge cells on the rim", () => {
    const rim = ALL_CELLS.filter((cell) => cellRing[cell] === 4)
    const corners = rim.filter((cell) => neighbourCount(cell) === 3)
    const edges = rim.filter((cell) => neighbourCount(cell) === 4)
    expect(corners).toHaveLength(6)
    expect(edges).toHaveLength(18)
  })
})

describe("lookups off the board", () => {
  it("returns NOWHERE for coordinates outside the hexagon", () => {
    expect(cellAt(5, 0)).toBe(NOWHERE)
    expect(cellAt(4, 4)).toBe(NOWHERE)
    expect(cellAt(-4, -1)).toBe(NOWHERE)
    expect(cellAt(0, 0)).toBe(cellNamed("0,0"))
  })

  it("returns NOWHERE for names that are not cells", () => {
    expect(cellNamed("5,0")).toBe(NOWHERE)
    expect(cellNamed("4,4")).toBe(NOWHERE)
    expect(cellNamed("")).toBe(NOWHERE)
    expect(cellNamed("e5")).toBe(NOWHERE)
  })

  it("steps off the rim into NOWHERE", () => {
    const corner = cellNamed("-4,0")
    expect(neighbour(corner, 3)).toBe(NOWHERE)
    expect(neighbour(corner, 0)).toBe(cellNamed("-3,0"))
  })

  it("still names the square beyond the rim", () => {
    expect(nameBeyond(cellNamed("4,0"), 0)).toBe("5,0")
  })
})

describe("headings", () => {
  it("reverses to the opposite heading", () => {
    for (let heading = 0; heading < HEADINGS; heading++) {
      expect(reverse(reverse(heading))).toBe(heading)
      expect(reverse(heading)).not.toBe(heading)
    }
  })

  it("veers both ways round, wrapping at either end", () => {
    expect(veer(0, -1)).toBe(5)
    expect(veer(5, 1)).toBe(0)
    expect(veer(2, 3)).toBe(reverse(2))
  })

  it("finds the heading between neighbours and none between strangers", () => {
    const centre = cellNamed("0,0")
    for (let heading = 0; heading < HEADINGS; heading++) {
      expect(headingBetween(centre, neighbour(centre, heading))).toBe(
        heading,
      )
    }
    expect(headingBetween(centre, cellNamed("2,0"))).toBe(NOWHERE)
    expect(headingBetween(centre, centre)).toBe(NOWHERE)
  })

  it("points each cell's rim heading at the nearest way off the board", () => {
    for (const cell of ALL_CELLS) {
      let steps = 0
      let cursor = cell
      while (cursor !== NOWHERE) {
        cursor = neighbour(cursor, cellRimHeading[cell])
        steps++
      }
      expect(steps).toBe(5 - cellRing[cell])
    }
  })
})

describe("separation", () => {
  it("measures hex distance", () => {
    const centre = cellNamed("0,0")
    expect(separation(centre, centre)).toBe(0)
    expect(separation(centre, cellNamed("4,0"))).toBe(4)
    expect(separation(cellNamed("-4,0"), cellNamed("4,0"))).toBe(8)
    expect(separation(cellNamed("1,-1"), cellNamed("-1,1"))).toBe(2)
  })
})

describe("coordinate tables", () => {
  it("hold each cell's axial coordinates, all within the rim", () => {
    for (const cell of ALL_CELLS) {
      expect(nameOf(cell)).toBe(`${cellRow[cell]},${cellCol[cell]}`)
      expect(Math.abs(cellRow[cell])).toBeLessThanOrEqual(RIM)
      expect(Math.abs(cellCol[cell])).toBeLessThanOrEqual(RIM)
    }
  })

  it("step each heading and its reverse back to where they started", () => {
    expect(HEADING_STEPS).toHaveLength(HEADINGS)
    for (let heading = 0; heading < HEADINGS; heading++) {
      const [dr, dq] = HEADING_STEPS[heading]
      const [backR, backQ] = HEADING_STEPS[reverse(heading)]
      expect(dr + backR).toBe(0)
      expect(dq + backQ).toBe(0)
    }
  })
})
