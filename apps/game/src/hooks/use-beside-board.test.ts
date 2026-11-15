import { afterEach, describe, expect, it, vi } from "vitest"
import { BESIDE_QUERY, isBesideBoard } from "@/hooks/use-beside-board"

describe("isBesideBoard", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("asks the browser the same question the stylesheet's beside variant does", () => {
    const matchMedia = vi.fn(() => ({ matches: true }))
    vi.stubGlobal("matchMedia", matchMedia)

    expect(isBesideBoard()).toBe(true)
    expect(matchMedia).toHaveBeenCalledWith(BESIDE_QUERY)
  })

  it("is false when the panel goes under the board", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false }))
    expect(isBesideBoard()).toBe(false)
  })

  //the server renders without a window, and a guide that is not there on the
  //server must not be there on the first client render either
  it("is never true without a window", () => {
    vi.stubGlobal("window", undefined)
    expect(isBesideBoard()).toBe(false)
  })
})
