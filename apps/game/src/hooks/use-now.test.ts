import { act } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useNow } from "@/hooks/use-now"
import { renderHook } from "@/test-support/render-hook"

describe("useNow", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("starts on the current time", () => {
    const hook = renderHook(() => useNow(1000))
    expect(hook.current).toBe(Date.now())
    hook.unmount()
  })

  it("reads the clock again every interval", () => {
    const hook = renderHook(() => useNow(1000))
    const first = hook.current

    act(() => vi.advanceTimersByTime(1000))
    expect(hook.current).toBe(first + 1000)

    act(() => vi.advanceTimersByTime(3000))
    expect(hook.current).toBe(first + 4000)
    hook.unmount()
  })

  it("does not tick between intervals", () => {
    const hook = renderHook(() => useNow(1000))
    const first = hook.current
    act(() => vi.advanceTimersByTime(999))
    expect(hook.current).toBe(first)
    hook.unmount()
  })

  it("stops its timer on unmount", () => {
    const hook = renderHook(() => useNow(1000))
    expect(vi.getTimerCount()).toBe(1)
    hook.unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
