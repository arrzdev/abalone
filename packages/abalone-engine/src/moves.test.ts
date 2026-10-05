import { describe, expect, it } from "vitest"
import {
  commitMove,
  destinationsFor,
  isUnbrokenLine,
  linesFor,
  orderLine,
  resolveMove,
} from "#abalone-engine/moves"
import {
  BLACK,
  namesOf,
  positionFromNames,
  VACANT,
  WHITE,
} from "#abalone-engine/position"
import { cellNamed, NOWHERE, nameOf } from "#abalone-engine/topology"

//heading 5 is the axial step [0, 1]: along row r = 0, left to right
const EAST = 5

function cells(...names: string[]): number[] {
  return names.map(cellNamed)
}

//commitMove only returns null for a move off the board; these tests never
//ask for one, so a null here is a failure, not a case
function committed(
  ...args: Parameters<typeof commitMove>
): NonNullable<ReturnType<typeof commitMove>> {
  const outcome = commitMove(...args)
  if (!outcome) throw new Error("expected the move to be played")
  return outcome
}

function destinations(
  black: string[],
  white: string[],
  line: string[],
): string[] {
  const position = positionFromNames(black, white)
  return destinationsFor(position, cells(...line), BLACK).map(nameOf)
}

describe("linesFor", () => {
  it("offers singles, then every pair and triple read from both ends", () => {
    const pair = positionFromNames(["0,0", "0,1"], [])
    expect(linesFor(pair, BLACK)).toHaveLength(2 + 2)

    const triple = positionFromNames(["0,0", "0,1", "0,2"], [])
    const lines = linesFor(triple, BLACK)
    expect(lines.slice(0, 3)).toEqual(
      cells("0,0", "0,1", "0,2").map((c) => [c]),
    )
    expect(lines.filter((line) => line.length === 2)).toHaveLength(4)
    expect(lines.filter((line) => line.length === 3)).toHaveLength(2)
  })

  it("does not pair a marble with an opponent", () => {
    const position = positionFromNames(["0,0"], ["0,1"])
    expect(linesFor(position, BLACK)).toEqual([cells("0,0")])
  })
})

describe("destinationsFor — plain moves", () => {
  it("lets a lone marble step onto any empty neighbour", () => {
    expect(destinations(["0,0"], [], ["0,0"])).toHaveLength(6)
  })

  it("never lets a lone marble push", () => {
    expect(destinations(["0,0"], ["0,1"], ["0,0"])).not.toContain("0,1")
  })

  it("gives a free pair two in-line and four broadside squares", () => {
    expect(destinations(["0,0", "0,1"], [], ["0,0", "0,1"])).toHaveLength(
      6,
    )
  })

  it("offers the same squares whichever end the line is read from", () => {
    const forward = destinations(["0,0", "0,1"], [], ["0,0", "0,1"])
    const backward = destinations(["0,0", "0,1"], [], ["0,1", "0,0"])
    //the same squares, though not always in the same order: CANONICAL_HEADING
    //leaves both headings of the r = 0 axis as they are
    expect(new Set(backward)).toEqual(new Set(forward))
  })

  it("blocks a broadside when any landing square is taken", () => {
    const found = destinations(["0,0", "0,1"], ["1,0"], ["0,0", "0,1"])
    expect(found).not.toContain("1,1")
    expect(found).not.toContain("1,-1")
    expect(found).toHaveLength(4)
  })

  it("does not walk a line into its own marble", () => {
    const found = destinations(["0,-1", "0,0", "0,1"], [], ["0,-1", "0,0"])
    expect(found).not.toContain("0,1")
  })

  it("offers nothing for an empty selection or a broken line", () => {
    expect(destinations(["0,0"], [], [])).toEqual([])
    expect(destinations(["0,0", "0,2"], [], ["0,0", "0,2"])).toEqual([])
  })
})

describe("destinationsFor — sumito", () => {
  it("lets two push one but not two", () => {
    expect(
      destinations(["0,-1", "0,0"], ["0,1"], ["0,-1", "0,0"]),
    ).toContain("0,1")
    expect(
      destinations(["0,-1", "0,0"], ["0,1", "0,2"], ["0,-1", "0,0"]),
    ).not.toContain("0,1")
  })

  it("lets three push two but not three", () => {
    const line = ["0,-2", "0,-1", "0,0"]
    expect(destinations(line, ["0,1", "0,2"], line)).toContain("0,1")
    expect(destinations(line, ["0,1", "0,2", "0,3"], line)).not.toContain(
      "0,1",
    )
  })

  it("refuses a push into a marble of the pushing side", () => {
    expect(
      destinations(["0,-1", "0,0", "0,2"], ["0,1"], ["0,-1", "0,0"]),
    ).not.toContain("0,1")
  })

  it("allows a push that drives a marble over the rim", () => {
    expect(
      destinations(["0,2", "0,3"], ["0,4"], ["0,2", "0,3"]),
    ).toContain("0,4")
  })
})

describe("resolveMove", () => {
  it("names the anchor, heading and every marble shoved", () => {
    const position = positionFromNames(
      ["0,-2", "0,-1", "0,0"],
      ["0,1", "0,2"],
    )
    const plan = resolveMove(
      position,
      cells("0,-2", "0,-1", "0,0"),
      cellNamed("0,1"),
      BLACK,
    )
    expect(plan).toEqual({
      anchor: cellNamed("0,0"),
      heading: EAST,
      shoved: cells("0,1", "0,2"),
    })
  })

  it("returns null when the target touches no marble of the line", () => {
    const position = positionFromNames(["0,0"], [])
    expect(
      resolveMove(position, cells("0,0"), cellNamed("0,2"), BLACK),
    ).toBeNull()
  })
})

describe("commitMove", () => {
  it("captures a marble shoved over the rim", () => {
    const position = positionFromNames(["-4,0", "0,2", "0,3"], ["0,4"])
    const outcome = committed(
      position,
      cells("0,2", "0,3"),
      EAST,
      cells("0,4"),
      BLACK,
    )

    expect(outcome.captured).toBe(1)
    expect(outcome.shovedTo).toEqual([NOWHERE])
    expect(outcome.landings).toEqual(cells("0,3", "0,4"))
    expect(namesOf(outcome.position, WHITE)).toEqual([])
    //movers go to the back of the roster, in the order the line names them
    expect(namesOf(outcome.position, BLACK)).toEqual([
      "-4,0",
      "0,3",
      "0,4",
    ])
    expect(outcome.position.occupant[cellNamed("0,2")]).toBe(VACANT)
  })

  it("moves a shoved marble that stays on the board", () => {
    const position = positionFromNames(["0,-1", "0,0"], ["0,1"])
    const outcome = committed(
      position,
      cells("0,-1", "0,0"),
      EAST,
      cells("0,1"),
      BLACK,
    )
    expect(outcome.captured).toBe(0)
    expect(namesOf(outcome.position, WHITE)).toEqual(["0,2"])
    expect(outcome.position.occupant[cellNamed("0,1")]).toBe(BLACK)
  })

  it("refuses to walk a marble off its own board", () => {
    const position = positionFromNames(["0,4"], [])
    expect(commitMove(position, cells("0,4"), EAST, [], BLACK)).toBeNull()
  })

  it("leaves the position it was given untouched", () => {
    const position = positionFromNames(["0,0"], ["4,0"])
    commitMove(position, cells("0,0"), EAST, [], BLACK)
    expect(namesOf(position, BLACK)).toEqual(["0,0"])
    expect(position.occupant[cellNamed("0,0")]).toBe(BLACK)
  })
})

describe("orderLine and isUnbrokenLine", () => {
  it("puts a clicked selection end to end without touching the input", () => {
    const clicked = cells("0,2", "0,0", "0,1")
    expect(orderLine(clicked)).toEqual(cells("0,0", "0,1", "0,2"))
    expect(clicked).toEqual(cells("0,2", "0,0", "0,1"))
  })

  it("accepts straight runs of up to three on every axis", () => {
    expect(isUnbrokenLine(cells("0,0"))).toBe(true)
    expect(isUnbrokenLine(orderLine(cells("0,0", "0,1", "0,2")))).toBe(
      true,
    )
    expect(isUnbrokenLine(orderLine(cells("-1,0", "0,0", "1,0")))).toBe(
      true,
    )
    expect(isUnbrokenLine(orderLine(cells("-1,1", "0,0", "1,-1")))).toBe(
      true,
    )
  })

  it("rejects gaps, bends and runs of four", () => {
    expect(isUnbrokenLine(orderLine(cells("0,0", "0,2")))).toBe(false)
    expect(isUnbrokenLine(orderLine(cells("0,0", "0,1", "1,1")))).toBe(
      false,
    )
    expect(
      isUnbrokenLine(orderLine(cells("0,0", "0,1", "0,2", "0,3"))),
    ).toBe(false)
  })
})
