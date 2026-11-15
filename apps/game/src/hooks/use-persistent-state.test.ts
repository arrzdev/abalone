import { act } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { usePersistentState } from "@/hooks/use-persistent-state"
import { stubMemoryStorage } from "@/test-support/memory-storage"
import { renderHook } from "@/test-support/render-hook"

const KEY = "abalone_test_pref"

function parseNumber(raw: string): number | null {
  const parsed = Number(raw)
  return Number.isNaN(parsed) ? null : parsed
}

function formatNumber(value: number): string | null {
  return value === 0 ? null : String(value)
}

function useCount() {
  return usePersistentState<number>(KEY, 5, parseNumber, formatNumber)
}

describe("usePersistentState", () => {
  beforeEach(() => {
    stubMemoryStorage()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("starts on the fallback when nothing is stored", () => {
    const hook = renderHook(useCount)
    expect(hook.current[0]).toBe(5)
    hook.unmount()
  })

  it("reads the stored value on the first render", () => {
    localStorage.setItem(KEY, "12")
    const hook = renderHook(useCount)
    expect(hook.current[0]).toBe(12)
    hook.unmount()
  })

  //stale or hand-edited storage must never reach a screen as NaN
  it("falls back when the stored value does not parse", () => {
    localStorage.setItem(KEY, "not a number")
    const hook = renderHook(useCount)
    expect(hook.current[0]).toBe(5)
    hook.unmount()
  })

  it("writes what it is set to, in the format it was given", () => {
    const hook = renderHook(useCount)
    act(() => hook.current[1](9))
    expect(hook.current[0]).toBe(9)
    expect(localStorage.getItem(KEY)).toBe("9")
    hook.unmount()
  })

  //"default" values stay out of storage: format says so by returning null
  it("clears the key when format returns null", () => {
    localStorage.setItem(KEY, "9")
    const hook = renderHook(useCount)
    act(() => hook.current[1](0))
    expect(hook.current[0]).toBe(0)
    expect(localStorage.getItem(KEY)).toBeNull()
    hook.unmount()
  })

  //the settings sheet and the page behind it hold the same key
  it("tells every mounted hook on the same key about a write", () => {
    const first = renderHook(useCount)
    const second = renderHook(useCount)

    act(() => first.current[1](7))

    expect(second.current[0]).toBe(7)
    first.unmount()
    second.unmount()
  })

  it("leaves hooks on other keys alone", () => {
    const first = renderHook(useCount)
    const other = renderHook(() =>
      usePersistentState<number>(
        "abalone_other_pref",
        1,
        parseNumber,
        formatNumber,
      ),
    )

    act(() => first.current[1](7))

    expect(other.current[0]).toBe(1)
    first.unmount()
    other.unmount()
  })

  it("stops hearing writes once unmounted", () => {
    const first = renderHook(useCount)
    const second = renderHook(useCount)
    second.unmount()

    expect(() => act(() => first.current[1](3))).not.toThrow()
    first.unmount()
  })

  it("keeps the setter stable across renders", () => {
    const hook = renderHook(useCount)
    const before = hook.current[1]
    act(() => hook.current[1](2))
    expect(hook.current[1]).toBe(before)
    hook.unmount()
  })

  //private windows and a full disk both throw; the preference still holds for
  //the session
  it("still updates when storage throws", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("denied")
      },
      setItem: () => {
        throw new Error("denied")
      },
      removeItem: () => {
        throw new Error("denied")
      },
    })

    const hook = renderHook(useCount)
    expect(hook.current[0]).toBe(5)
    act(() => hook.current[1](8))
    expect(hook.current[0]).toBe(8)
    hook.unmount()
  })
})
