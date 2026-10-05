import { describe, expect, it } from "vitest"
import {
  BLACK,
  createPosition,
  marbleCount,
  namesOf,
  positionFromNames,
  rival,
  sideFromName,
  sideName,
  signature,
  signatureOfNames,
  VACANT,
  WHITE,
} from "#abalone-engine/position"
import { cellNamed } from "#abalone-engine/topology"

describe("sides", () => {
  it("flips to the rival side and translates to player names", () => {
    expect(rival(BLACK)).toBe(WHITE)
    expect(rival(WHITE)).toBe(BLACK)
    expect(sideName(BLACK)).toBe("black")
    expect(sideName(WHITE)).toBe("white")
    expect(sideFromName("black")).toBe(BLACK)
    expect(sideFromName("white")).toBe(WHITE)
  })
})

describe("building a position", () => {
  it("records each side in both the occupant table and the roster", () => {
    const blackCell = cellNamed("0,0")
    const whiteCell = cellNamed("0,1")
    const position = createPosition([blackCell], [whiteCell])

    expect(position.occupant[blackCell]).toBe(BLACK)
    expect(position.occupant[whiteCell]).toBe(WHITE)
    expect(position.occupant[cellNamed("1,0")]).toBe(VACANT)
    expect(position.roster[BLACK]).toEqual([blackCell])
    expect(position.roster[WHITE]).toEqual([whiteCell])
  })

  it("drops names that are not on the board", () => {
    const position = positionFromNames(["0,0", "9,9", "x"], ["0,1"])
    expect(marbleCount(position, BLACK)).toBe(1)
    expect(namesOf(position, WHITE)).toEqual(["0,1"])
  })

  it("keeps marbles in the order they were given", () => {
    const position = positionFromNames(["1,0", "0,0", "-1,0"], [])
    expect(namesOf(position, BLACK)).toEqual(["1,0", "0,0", "-1,0"])
  })
})

describe("signature", () => {
  it("ignores roster order", () => {
    const one = positionFromNames(["0,0", "1,0"], ["4,0"])
    const other = positionFromNames(["1,0", "0,0"], ["4,0"])
    expect(signature(one, BLACK)).toBe(signature(other, BLACK))
  })

  it("tells apart the side to move and the colours", () => {
    const position = positionFromNames(["0,0"], ["1,0"])
    const swapped = positionFromNames(["1,0"], ["0,0"])
    expect(signature(position, BLACK)).not.toBe(signature(position, WHITE))
    expect(signature(position, BLACK)).not.toBe(signature(swapped, BLACK))
  })

  it("separates cells that share a bit in different words", () => {
    //cell 0 sets bit 0 of the low word and cell 32 bit 0 of the high one
    const low = createPosition([0], [])
    const high = createPosition([32], [])
    expect(signature(low, BLACK)).not.toBe(signature(high, BLACK))
  })

  it("reads the same from named squares in any order", () => {
    expect(signatureOfNames(["0,0", "1,0"], ["4,0"], "black")).toBe(
      signatureOfNames(["1,0", "0,0"], ["4,0"], "black"),
    )
    expect(signatureOfNames(["0,0"], [], "black")).not.toBe(
      signatureOfNames(["0,0"], [], "white"),
    )
  })
})
