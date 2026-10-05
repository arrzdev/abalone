import { describe, expect, it } from "vitest"
import {
  BOARD_SETUPS,
  DEFAULT_SETUP,
  isPlayableSetup,
  PLAYABLE_SETUPS,
} from "#abalone-engine/board-setups"
import { MARBLES_PER_SIDE } from "#abalone-engine/config"
import { cellAt, NOWHERE } from "#abalone-engine/topology"

const keyed = (cells: [number, number][]) =>
  cells.map(([r, q]) => `${r},${q}`)

describe("BOARD_SETUPS", () => {
  it("gives each side a full set in every playable opening", () => {
    for (const key of PLAYABLE_SETUPS) {
      const setup = BOARD_SETUPS[key]
      expect(setup.black, key).toHaveLength(MARBLES_PER_SIDE)
      expect(setup.white, key).toHaveLength(MARBLES_PER_SIDE)
    }
  })

  it("puts every marble on its own square of the board", () => {
    for (const [key, setup] of Object.entries(BOARD_SETUPS)) {
      const all = [...setup.black, ...setup.white]
      for (const [r, q] of all) expect(cellAt(r, q), key).not.toBe(NOWHERE)
      expect(new Set(keyed(all)).size, key).toBe(all.length)
    }
  })

  it("reads the standard opening with black on the bottom three rows", () => {
    const standard = BOARD_SETUPS.standard
    expect(standard.black.every(([r]) => r >= 2)).toBe(true)
    expect(standard.white.every(([r]) => r <= -2)).toBe(true)
    expect(keyed(standard.black)).toContain("2,0")
    expect(keyed(standard.white)).toContain("-4,4")
  })
})

describe("playable setups", () => {
  it("offers every opening but the custom sandbox", () => {
    expect(PLAYABLE_SETUPS).toHaveLength(
      Object.keys(BOARD_SETUPS).length - 1,
    )
    expect(PLAYABLE_SETUPS).toContain(DEFAULT_SETUP)
    expect(PLAYABLE_SETUPS).not.toContain("custom")
  })

  it("recognises playable keys and nothing else", () => {
    expect(isPlayableSetup("the_wall")).toBe(true)
    expect(isPlayableSetup("custom")).toBe(false)
    expect(isPlayableSetup("nonsense")).toBe(false)
    expect(isPlayableSetup("")).toBe(false)
  })
})
