import { afterEach, describe, expect, it, vi } from "vitest"
import {
  arrivedByPlaying,
  easeInOutCubic,
  interpolate,
  prefersReducedMotion,
} from "@/render/motion"

describe("easeInOutCubic", () => {
  it("starts at 0, ends at 1 and is even through the middle", () => {
    expect(easeInOutCubic(0)).toBe(0)
    expect(easeInOutCubic(1)).toBe(1)
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5)
  })

  it("is slow to leave and slow to arrive", () => {
    expect(easeInOutCubic(0.1)).toBeLessThan(0.1)
    expect(easeInOutCubic(0.9)).toBeGreaterThan(0.9)
  })

  it("is symmetric around the middle", () => {
    for (const t of [0.1, 0.25, 0.4]) {
      expect(easeInOutCubic(t) + easeInOutCubic(1 - t)).toBeCloseTo(1)
    }
  })

  it("never goes backwards", () => {
    let last = 0
    for (let step = 1; step <= 100; step++) {
      const eased = easeInOutCubic(step / 100)
      expect(eased).toBeGreaterThanOrEqual(last)
      last = eased
    }
  })
})

describe("interpolate", () => {
  const from = { x: 10, y: 20 }
  const to = { x: 110, y: -80 }

  it("is the ends at 0 and 1", () => {
    expect(interpolate(from, to, 0)).toEqual(from)
    expect(interpolate(from, to, 1)).toEqual(to)
  })

  it("is the point part of the way between", () => {
    expect(interpolate(from, to, 0.25)).toEqual({ x: 35, y: -5 })
  })

  it("does not change what it was given", () => {
    interpolate(from, to, 0.5)
    expect(from).toEqual({ x: 10, y: 20 })
  })
})

describe("arrivedByPlaying", () => {
  it("is true when the list grew and the board stands on its new last move", () => {
    expect(
      arrivedByPlaying({ index: 3, moves: 4 }, { index: 4, moves: 5 }),
    ).toBe(true)
  })

  it("counts the first move from a board nothing was drawn on", () => {
    expect(
      arrivedByPlaying({ index: null, moves: 0 }, { index: 1, moves: 2 }),
    ).toBe(true)
  })

  it("is false when stepping through history: the list did not grow", () => {
    expect(
      arrivedByPlaying({ index: 2, moves: 5 }, { index: 3, moves: 5 }),
    ).toBe(false)
  })

  it("is false when jumping ahead more than one move", () => {
    expect(
      arrivedByPlaying({ index: 1, moves: 5 }, { index: 4, moves: 5 }),
    ).toBe(false)
  })

  it("is true for playing on from a rewound position", () => {
    //rewound to 2 of 6, then a move: the list is cut and re-grown to 4
    expect(
      arrivedByPlaying({ index: 2, moves: 6 }, { index: 3, moves: 4 }),
    ).toBe(true)
  })

  it("is false when the board is not on the newest move", () => {
    expect(
      arrivedByPlaying({ index: 3, moves: 4 }, { index: 4, moves: 7 }),
    ).toBe(false)
  })
})

describe("prefersReducedMotion", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("follows the system setting", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query === "(prefers-reduced-motion: reduce)",
    }))
    expect(prefersReducedMotion()).toBe(true)

    vi.stubGlobal("matchMedia", () => ({ matches: false }))
    expect(prefersReducedMotion()).toBe(false)
  })

  it("is false where there is no matchMedia", () => {
    vi.stubGlobal("matchMedia", undefined)
    expect(prefersReducedMotion()).toBe(false)
  })
})
