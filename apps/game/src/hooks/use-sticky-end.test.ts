import { act } from "react"
import { describe, expect, it } from "vitest"
import { useStickyEnd } from "@/hooks/use-sticky-end"
import { renderHook } from "@/test-support/render-hook"

//a box with the scroll geometry the hook reads; happy-dom lays nothing out
function scroller(geometry: {
  scrollHeight?: number
  clientHeight?: number
  scrollTop?: number
  scrollWidth?: number
  clientWidth?: number
  scrollLeft?: number
}): HTMLElement {
  const element = document.createElement("div")
  for (const [name, value] of Object.entries(geometry)) {
    Object.defineProperty(element, name, {
      value,
      writable: true,
      configurable: true,
    })
  }
  return element
}

function scrollTo(
  element: HTMLElement,
  property: "scrollTop" | "scrollLeft",
  value: number,
) {
  act(() => {
    Object.assign(element, { [property]: value })
    element.dispatchEvent(new Event("scroll"))
  })
}

describe("useStickyEnd", () => {
  it("follow goes to the end", () => {
    const box = scroller({
      scrollHeight: 500,
      clientHeight: 100,
      scrollTop: 0,
    })
    const hook = renderHook(() => useStickyEnd({ current: box }, 1))

    act(() => hook.current.follow())

    expect(box.scrollTop).toBe(500)
    hook.unmount()
  })

  //a reader who has not scrolled is standing at the foot
  it("follows what arrives while the reader is at the end", () => {
    const box = scroller({
      scrollHeight: 500,
      clientHeight: 100,
      scrollTop: 400,
    })
    const hook = renderHook(() => useStickyEnd({ current: box }, 1))

    act(() => hook.current.followIfPinned())

    expect(box.scrollTop).toBe(500)
    hook.unmount()
  })

  //nothing moves under someone who went up to read something
  it("leaves a reader who scrolled away where they are", () => {
    const box = scroller({
      scrollHeight: 500,
      clientHeight: 100,
      scrollTop: 400,
    })
    const hook = renderHook(() => useStickyEnd({ current: box }, 1))

    scrollTo(box, "scrollTop", 100)
    act(() => hook.current.followIfPinned())

    expect(box.scrollTop).toBe(100)
    hook.unmount()
  })

  it("follows again once the reader comes back to the end", () => {
    const box = scroller({
      scrollHeight: 500,
      clientHeight: 100,
      scrollTop: 400,
    })
    const hook = renderHook(() => useStickyEnd({ current: box }, 1))
    scrollTo(box, "scrollTop", 100)

    scrollTo(box, "scrollTop", 400)
    act(() => hook.current.followIfPinned())

    expect(box.scrollTop).toBe(500)
    hook.unmount()
  })

  //a flick that stops a few pixels short of the foot was a flick to the foot
  it("counts a few pixels short of the end as being at it", () => {
    const box = scroller({
      scrollHeight: 500,
      clientHeight: 100,
      scrollTop: 400,
    })
    const hook = renderHook(() => useStickyEnd({ current: box }, 1))

    scrollTo(box, "scrollTop", 400 - 8)
    act(() => hook.current.followIfPinned())
    expect(box.scrollTop).toBe(500)

    scrollTo(box, "scrollTop", 400 - 9)
    act(() => hook.current.followIfPinned())
    expect(box.scrollTop).toBe(391)
    hook.unmount()
  })

  it("follow re-pins a reader who had scrolled away", () => {
    const box = scroller({
      scrollHeight: 500,
      clientHeight: 100,
      scrollTop: 400,
    })
    const hook = renderHook(() => useStickyEnd({ current: box }, 1))
    scrollTo(box, "scrollTop", 100)

    act(() => hook.current.follow())
    Object.assign(box, { scrollTop: 400 })
    act(() => hook.current.followIfPinned())

    expect(box.scrollTop).toBe(500)
    hook.unmount()
  })

  it("works along the x axis for the strip", () => {
    const box = scroller({
      scrollWidth: 900,
      clientWidth: 300,
      scrollLeft: 0,
    })
    const hook = renderHook(() => useStickyEnd({ current: box }, 1, "x"))

    act(() => hook.current.follow())

    expect(box.scrollLeft).toBe(900)
    hook.unmount()
  })

  it("does nothing without an element", () => {
    const hook = renderHook(() => useStickyEnd({ current: null }, 1))
    expect(() => act(() => hook.current.follow())).not.toThrow()
    expect(() => act(() => hook.current.followIfPinned())).not.toThrow()
    hook.unmount()
  })
})
