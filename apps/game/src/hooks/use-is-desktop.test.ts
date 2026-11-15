import { beforeEach, describe, expect, it, vi } from "vitest"
import { DESKTOP_QUERY, useIsDesktop } from "@/hooks/use-is-desktop"
import { renderHook } from "@/test-support/render-hook"

//the hook is the shell's one breakpoint: what matters is that it asks the
//media-query hook for Tailwind's `lg` and hands the answer back untouched
const mediaQuery = vi.hoisted(() => ({ useMediaQuery: vi.fn() }))

vi.mock("@repo/nativ/hooks", () => mediaQuery)

describe("useIsDesktop", () => {
  beforeEach(() => {
    mediaQuery.useMediaQuery.mockReset()
  })

  it("asks for Tailwind's lg breakpoint", () => {
    mediaQuery.useMediaQuery.mockReturnValue(false)

    renderHook(() => useIsDesktop())

    expect(mediaQuery.useMediaQuery).toHaveBeenCalledWith(DESKTOP_QUERY)
    expect(DESKTOP_QUERY).toBe("(min-width: 64rem)")
  })

  it("reports whether the query matches", () => {
    mediaQuery.useMediaQuery.mockReturnValue(true)
    expect(renderHook(() => useIsDesktop()).current).toBe(true)

    mediaQuery.useMediaQuery.mockReturnValue(false)
    expect(renderHook(() => useIsDesktop()).current).toBe(false)
  })
})
