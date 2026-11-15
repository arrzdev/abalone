import { describe, expect, it } from "vitest"
import {
  BOARD_REACH,
  cellFromPoint,
  hexCenter,
  STEP,
} from "@/render/hex-grid"

const CENTER_X = 400
const CENTER_Y = 350
const SPACING = 40

//rounding a small negative gives -0, which is the same cell but not `toEqual`
function cell(found: ReturnType<typeof cellFromPoint>) {
  return found && [found[0] + 0, found[1] + 0]
}

describe("hexCenter", () => {
  it("puts the middle cell on the centre", () => {
    expect(hexCenter(0, 0, CENTER_X, CENTER_Y, SPACING)).toEqual({
      x: CENTER_X,
      y: CENTER_Y,
    })
  })

  it("steps along a row by STEP times the spacing", () => {
    const origin = hexCenter(0, 0, CENTER_X, CENTER_Y, SPACING)
    const next = hexCenter(0, 1, CENTER_X, CENTER_Y, SPACING)

    expect(next.x - origin.x).toBeCloseTo(STEP * SPACING)
    expect(next.y).toBe(origin.y)
  })

  //every heading is the same length, which is what makes it a hex grid
  it("is the same distance to all six neighbours", () => {
    const origin = hexCenter(0, 0, CENTER_X, CENTER_Y, SPACING)
    const headings = [
      [0, 1],
      [0, -1],
      [1, 0],
      [-1, 0],
      [1, -1],
      [-1, 1],
    ]
    for (const [r, q] of headings) {
      const point = hexCenter(r, q, CENTER_X, CENTER_Y, SPACING)
      const distance = Math.hypot(point.x - origin.x, point.y - origin.y)
      expect(distance, `${r},${q}`).toBeCloseTo(STEP * SPACING)
    }
  })

  it("turns the board half a turn when flipped", () => {
    const point = hexCenter(2, -1, CENTER_X, CENTER_Y, SPACING)
    const flipped = hexCenter(2, -1, CENTER_X, CENTER_Y, SPACING, true)

    expect(flipped.x - CENTER_X).toBeCloseTo(-(point.x - CENTER_X))
    expect(flipped.y - CENTER_Y).toBeCloseTo(-(point.y - CENTER_Y))
  })
})

describe("cellFromPoint", () => {
  it("is the inverse of hexCenter for every cell on the board", () => {
    let onBoard = 0
    for (let r = -BOARD_REACH; r <= BOARD_REACH; r++) {
      for (let q = -BOARD_REACH; q <= BOARD_REACH; q++) {
        const { x, y } = hexCenter(r, q, CENTER_X, CENTER_Y, SPACING)
        const found = cellFromPoint(x, y, CENTER_X, CENTER_Y, SPACING)
        //the square grid of candidates includes corners that are off the board
        if (!found) continue
        onBoard++
        expect(cell(found), `${r},${q}`).toEqual([r, q])
      }
    }
    //a hexagon of side 5
    expect(onBoard).toBe(61)
  })

  it("finds the middle cell from a point near its centre", () => {
    expect(
      cell(
        cellFromPoint(
          CENTER_X + 5,
          CENTER_Y - 5,
          CENTER_X,
          CENTER_Y,
          SPACING,
        ),
      ),
    ).toEqual([0, 0])
  })

  it("answers with the cell that was drawn there, when flipped", () => {
    const { x, y } = hexCenter(2, -1, CENTER_X, CENTER_Y, SPACING, true)

    expect(
      cell(cellFromPoint(x, y, CENTER_X, CENTER_Y, SPACING, true)),
    ).toEqual([2, -1])
  })

  it("is null for a point off the board", () => {
    expect(cellFromPoint(0, 0, CENTER_X, CENTER_Y, SPACING)).toBeNull()
    expect(
      cellFromPoint(5000, 5000, CENTER_X, CENTER_Y, SPACING),
    ).toBeNull()
  })
})

describe("BOARD_REACH", () => {
  it("is the number of steps from the middle to the rim", () => {
    expect(BOARD_REACH).toBeGreaterThanOrEqual(4)
  })
})
