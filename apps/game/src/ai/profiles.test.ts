import { describe, expect, it } from "vitest"
import { LEVELS, profileFor, STRONGEST, WEAKEST } from "@/ai/profiles"

describe("bot profiles", () => {
  it("offers eight levels from 1 to 8", () => {
    expect(LEVELS).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect(WEAKEST).toBe(1)
    expect(STRONGEST).toBe(8)
  })

  it("gives each level its own profile", () => {
    expect(profileFor(3)).not.toEqual(profileFor(4))
    expect(profileFor(8).depth).toBeGreaterThan(profileFor(1).depth)
  })

  it("falls back to the weakest bot for a level that does not exist", () => {
    expect(profileFor(0)).toBe(profileFor(WEAKEST))
    expect(profileFor(99)).toBe(profileFor(WEAKEST))
    expect(profileFor(Number.NaN)).toBe(profileFor(WEAKEST))
  })

  it("never looks less far ahead, or throws moves away more, as the level rises", () => {
    for (const level of LEVELS.slice(1)) {
      const weaker = profileFor(level - 1)
      const stronger = profileFor(level)
      expect(stronger.depth).toBeGreaterThanOrEqual(weaker.depth)
      expect(stronger.caprice).toBeLessThanOrEqual(weaker.caprice)
    }
  })

  it("lets the strongest bots play without whims", () => {
    for (const level of [STRONGEST - 1, STRONGEST]) {
      expect(profileFor(level).caprice).toBe(0)
    }
  })

  it("cannot be retuned from outside", () => {
    expect(Object.isFrozen(profileFor(5))).toBe(true)
  })
})
