import { afterEach, describe, expect, it, vi } from "vitest"
import { clamp } from "#nativ/utils/clamp"
import { cn } from "#nativ/utils/cn"
import { dynamicValues } from "#nativ/utils/dynamic-values"
import { isTouchDevice } from "#nativ/utils/is-touch-device"
import { isIOS } from "#nativ/utils/platform"

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("clamp", () => {
  it("keeps a value inside the range and pins one outside it", () => {
    expect(clamp(5, 0, 10)).toBe(5)
    expect(clamp(-1, 0, 10)).toBe(0)
    expect(clamp(11, 0, 10)).toBe(10)
  })
})

describe("cn", () => {
  it("joins conditional classes and lets the last tailwind conflict win", () => {
    expect(cn("p-2", false, ["text-sm", { hidden: true }], "p-4")).toBe(
      "text-sm hidden p-4",
    )
  })

  it("treats the safe area padding as a padding utility", () => {
    expect(cn("pb-0", "pb-safe")).toBe("pb-safe")
    expect(cn("px-safe", "px-2")).toBe("px-2")
  })

  it("keeps one class per touch and scroll behaviour group", () => {
    expect(cn("clickable", "non-clickable")).toBe("non-clickable")
    expect(cn("scrollable-x", "scrollable-y")).toBe("scrollable-y")
  })
})

describe("dynamicValues", () => {
  it("derives from the size in tailwind spacing units by default", () => {
    const derived = dynamicValues({ size: 8, derive: (ctx) => ctx })

    expect(derived).toEqual({ size: 8, edgeRem: 2 })
  })

  it("uses a custom rem per unit", () => {
    const edge = dynamicValues({
      size: 4,
      unitRem: 0.5,
      derive: ({ edgeRem }) => `${edgeRem}rem`,
    })

    expect(edge).toBe("2rem")
  })
})

describe("isTouchDevice", () => {
  it("is false without a window, as during server rendering", () => {
    vi.stubGlobal("window", undefined)

    expect(isTouchDevice()).toBe(false)
  })

  it("is true when the window takes touch events", () => {
    vi.stubGlobal("window", { ontouchstart: null })

    expect(isTouchDevice()).toBe(true)
  })

  it("follows the number of touch points otherwise", () => {
    vi.stubGlobal("window", {})
    vi.stubGlobal("navigator", { maxTouchPoints: 5 })
    expect(isTouchDevice()).toBe(true)

    vi.stubGlobal("navigator", { maxTouchPoints: 0 })
    expect(isTouchDevice()).toBe(false)
  })
})

describe("isIOS", () => {
  it("is false without a navigator", () => {
    vi.stubGlobal("navigator", undefined)

    expect(isIOS()).toBe(false)
  })

  it("is true for an iPhone user agent", () => {
    vi.stubGlobal("navigator", {
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
    })

    expect(isIOS()).toBe(true)
  })

  it("is true for an iPad that reports itself as a touch Mac", () => {
    vi.stubGlobal("navigator", {
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
      platform: "MacIntel",
      maxTouchPoints: 5,
    })

    expect(isIOS()).toBe(true)
  })

  it("is false for a desktop Mac", () => {
    vi.stubGlobal("navigator", {
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
      platform: "MacIntel",
      maxTouchPoints: 0,
    })

    expect(isIOS()).toBe(false)
  })
})
