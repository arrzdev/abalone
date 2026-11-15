import { act } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { useClickOutside } from "@/hooks/use-click-outside"
import { renderHook } from "@/test-support/render-hook"

function press(target: Element, type: "mousedown" | "touchstart") {
  act(() => {
    target.dispatchEvent(new Event(type, { bubbles: true }))
  })
}

describe("useClickOutside", () => {
  const inside = document.createElement("div")
  const outside = document.createElement("div")
  inside.appendChild(document.createElement("span"))
  document.body.appendChild(inside)
  document.body.appendChild(outside)

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("calls the handler for a press outside the element", () => {
    const handler = vi.fn()
    const hook = renderHook(() =>
      useClickOutside({ current: inside }, handler),
    )

    press(outside, "mousedown")

    expect(handler).toHaveBeenCalledTimes(1)
    hook.unmount()
  })

  it("listens for touch as well as mouse", () => {
    const handler = vi.fn()
    const hook = renderHook(() =>
      useClickOutside({ current: inside }, handler),
    )

    press(outside, "touchstart")

    expect(handler).toHaveBeenCalledTimes(1)
    hook.unmount()
  })

  it("ignores a press on the element and on what it contains", () => {
    const handler = vi.fn()
    const hook = renderHook(() =>
      useClickOutside({ current: inside }, handler),
    )

    press(inside, "mousedown")
    press(inside.firstElementChild as Element, "mousedown")

    expect(handler).not.toHaveBeenCalled()
    hook.unmount()
  })

  it("does nothing while inactive", () => {
    const handler = vi.fn()
    const hook = renderHook(() =>
      useClickOutside({ current: inside }, handler, false),
    )

    press(outside, "mousedown")

    expect(handler).not.toHaveBeenCalled()
    hook.unmount()
  })

  it("treats every press as outside when the ref is empty", () => {
    const handler = vi.fn()
    const hook = renderHook(() =>
      useClickOutside({ current: null }, handler),
    )

    press(inside, "mousedown")

    expect(handler).toHaveBeenCalledTimes(1)
    hook.unmount()
  })

  it("stops listening on unmount", () => {
    const handler = vi.fn()
    const hook = renderHook(() =>
      useClickOutside({ current: inside }, handler),
    )
    hook.unmount()

    press(outside, "mousedown")

    expect(handler).not.toHaveBeenCalled()
  })
})
