import { act } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useBoardTheme } from "@/hooks/use-board-theme"
import { stubMemoryStorage } from "@/test-support/memory-storage"
import { renderHook } from "@/test-support/render-hook"

const KEY = "abalone_boardTheme"

describe("useBoardTheme", () => {
  beforeEach(() => {
    stubMemoryStorage()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("is Slate until a theme is chosen", () => {
    const hook = renderHook(useBoardTheme)
    expect(hook.current[0]).toBe("slate")
    hook.unmount()
  })

  it("restores a saved theme", () => {
    localStorage.setItem(KEY, JSON.stringify("walnut"))
    const hook = renderHook(useBoardTheme)
    expect(hook.current[0]).toBe("walnut")
    hook.unmount()
  })

  //a theme a later build dropped must not leave the board unpainted
  it("reads a theme this build does not ship as Slate", () => {
    localStorage.setItem(KEY, JSON.stringify("neon"))
    const hook = renderHook(useBoardTheme)
    expect(hook.current[0]).toBe("slate")
    hook.unmount()
  })

  it("reads a value that is not JSON as Slate", () => {
    localStorage.setItem(KEY, "{walnut")
    const hook = renderHook(useBoardTheme)
    expect(hook.current[0]).toBe("slate")
    hook.unmount()
  })

  //"toString" is on every object; it is not a theme
  it("does not mistake an inherited property name for a theme", () => {
    localStorage.setItem(KEY, JSON.stringify("toString"))
    const hook = renderHook(useBoardTheme)
    expect(hook.current[0]).toBe("slate")
    hook.unmount()
  })

  it("saves a choice as JSON", () => {
    const hook = renderHook(useBoardTheme)
    act(() => hook.current[1]("felt"))
    expect(localStorage.getItem(KEY)).toBe('"felt"')
    hook.unmount()
  })
})
