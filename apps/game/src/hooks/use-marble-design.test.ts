import { act } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useMarbleDesign } from "@/hooks/use-marble-design"
import { stubMemoryStorage } from "@/test-support/memory-storage"
import { renderHook } from "@/test-support/render-hook"

const KEY = "abalone_marbleDesign"

describe("useMarbleDesign", () => {
  beforeEach(() => {
    stubMemoryStorage()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("is the 3d marble until one is chosen", () => {
    const hook = renderHook(useMarbleDesign)
    expect(hook.current[0]).toBe("3d")
    hook.unmount()
  })

  it("restores a saved design", () => {
    localStorage.setItem(KEY, JSON.stringify("pool"))
    const hook = renderHook(useMarbleDesign)
    expect(hook.current[0]).toBe("pool")
    hook.unmount()
  })

  it("falls back on a design this build no longer ships", () => {
    localStorage.setItem(KEY, JSON.stringify("retired-design"))
    const hook = renderHook(useMarbleDesign)
    expect(hook.current[0]).toBe("3d")
    hook.unmount()
  })

  it("falls back on a value that is not a string", () => {
    localStorage.setItem(KEY, "42")
    const hook = renderHook(useMarbleDesign)
    expect(hook.current[0]).toBe("3d")
    hook.unmount()
  })

  it("saves a choice as JSON", () => {
    const hook = renderHook(useMarbleDesign)
    act(() => hook.current[1]("pool"))
    expect(localStorage.getItem(KEY)).toBe('"pool"')
    hook.unmount()
  })
})
