import type { MouseEvent, PointerEvent } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  isTapEcho,
  markTapHandled,
  TAP_SLOP,
  useClickFix,
} from "@/hooks/use-click-fix"
import { renderHook } from "@/test-support/render-hook"

//just the fields the handlers read off a pointer event
function pointer(
  x: number,
  y: number,
  overrides: { button?: number; isPrimary?: boolean } = {},
) {
  return {
    clientX: x,
    clientY: y,
    button: 0,
    isPrimary: true,
    ...overrides,
  } as PointerEvent<HTMLElement>
}

function click(detail: number) {
  return { detail } as MouseEvent<HTMLElement>
}

//the module remembers the last tap for the whole app, so each test starts a
//long way after the last one
let clock = 1_000_000

describe("useClickFix", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    clock += 10_000
    vi.setSystemTime(clock)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe("a tap", () => {
    it("presses on release, not on press", () => {
      const callback = vi.fn()
      const hook = renderHook(() => useClickFix(callback))

      hook.current.onPointerDown(pointer(10, 10))
      expect(callback).not.toHaveBeenCalled()

      hook.current.onPointerUp(pointer(10, 10))
      expect(callback).toHaveBeenCalledTimes(1)
      hook.unmount()
    })

    it("allows a little wobble between press and release", () => {
      const callback = vi.fn()
      const hook = renderHook(() => useClickFix(callback))

      hook.current.onPointerDown(pointer(10, 10))
      hook.current.onPointerUp(pointer(10 + TAP_SLOP, 10 - TAP_SLOP))

      expect(callback).toHaveBeenCalledTimes(1)
      hook.unmount()
    })

    //a finger that travelled was scrolling the panel the control sits in
    it("does not press when the finger travelled further than the slop", () => {
      const callback = vi.fn()
      const hook = renderHook(() => useClickFix(callback))

      hook.current.onPointerDown(pointer(10, 10))
      hook.current.onPointerUp(pointer(10, 10 + TAP_SLOP + 1))

      expect(callback).not.toHaveBeenCalled()
      hook.unmount()
    })

    it("does not press on a release it never saw the press for", () => {
      const callback = vi.fn()
      const hook = renderHook(() => useClickFix(callback))

      hook.current.onPointerUp(pointer(10, 10))

      expect(callback).not.toHaveBeenCalled()
      hook.unmount()
    })

    it("ignores a press that is not the primary button or first finger", () => {
      const callback = vi.fn()
      const hook = renderHook(() => useClickFix(callback))

      hook.current.onPointerDown(pointer(10, 10, { button: 2 }))
      hook.current.onPointerUp(pointer(10, 10))
      hook.current.onPointerDown(pointer(10, 10, { isPrimary: false }))
      hook.current.onPointerUp(pointer(10, 10))

      expect(callback).not.toHaveBeenCalled()
      hook.unmount()
    })

    //a press the browser takes away to pan with must not go off at the next release
    it("forgets a press the browser cancelled", () => {
      const callback = vi.fn()
      const hook = renderHook(() => useClickFix(callback))

      hook.current.onPointerDown(pointer(10, 10))
      hook.current.onPointerCancel()
      hook.current.onPointerUp(pointer(10, 10))

      expect(callback).not.toHaveBeenCalled()
      hook.unmount()
    })

    it("presses once per press", () => {
      const callback = vi.fn()
      const hook = renderHook(() => useClickFix(callback))

      hook.current.onPointerDown(pointer(10, 10))
      hook.current.onPointerUp(pointer(10, 10))
      hook.current.onPointerUp(pointer(10, 10))

      expect(callback).toHaveBeenCalledTimes(1)
      hook.unmount()
    })

    it("is safe without a callback", () => {
      const hook = renderHook(() => useClickFix())

      hook.current.onPointerDown(pointer(10, 10))
      expect(() => hook.current.onPointerUp(pointer(10, 10))).not.toThrow()
      expect(() => hook.current.onClick(click(1))).not.toThrow()
      hook.unmount()
    })
  })

  describe("the click that follows", () => {
    //the echo iOS delivers, possibly against another control
    it("is swallowed as the echo of the tap just handled", () => {
      const callback = vi.fn()
      const hook = renderHook(() => useClickFix(callback))

      hook.current.onPointerDown(pointer(10, 10))
      hook.current.onPointerUp(pointer(10, 10))
      callback.mockClear()

      hook.current.onClick(click(1))

      expect(callback).not.toHaveBeenCalled()
      hook.unmount()
    })

    it("presses once the echo window has passed", () => {
      const callback = vi.fn()
      const hook = renderHook(() => useClickFix(callback))
      markTapHandled()

      vi.advanceTimersByTime(700)
      hook.current.onClick(click(1))

      expect(callback).toHaveBeenCalledTimes(1)
      hook.unmount()
    })

    //Enter or Space on a focused control, and a screen reader's press, send no
    //pointer events: dropping them is what would break keyboard use
    it("always presses for a click nothing pointed with", () => {
      const callback = vi.fn()
      const hook = renderHook(() => useClickFix(callback))
      markTapHandled()

      hook.current.onClick(click(0))

      expect(callback).toHaveBeenCalledTimes(1)
      hook.unmount()
    })

    it("recognises the echo of a tap handled elsewhere, such as the board", () => {
      markTapHandled()
      expect(isTapEcho({ detail: 1 })).toBe(true)
      expect(isTapEcho({ detail: 0 })).toBe(false)

      vi.advanceTimersByTime(700)
      expect(isTapEcho({ detail: 1 })).toBe(false)
    })
  })
})
