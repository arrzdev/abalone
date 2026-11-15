import { act } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { ScrollEdges } from "@/hooks/use-scroll-edges"
import { useScrollEdges } from "@/hooks/use-scroll-edges"
import { renderHook } from "@/test-support/render-hook"
import { renderHookWithProps } from "@/test-support/render-hook-with-props"

function scroller(geometry: Record<string, number>): HTMLElement {
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

function scrollTo(element: HTMLElement, property: string, value: number) {
  act(() => {
    Object.assign(element, { [property]: value })
    element.dispatchEvent(new Event("scroll"))
  })
}

const observers: FakeResizeObserver[] = []

class FakeResizeObserver {
  disconnected = false

  constructor(private readonly callback: () => void) {
    observers.push(this)
  }

  observe() {}

  disconnect() {
    this.disconnected = true
  }

  fire() {
    this.callback()
  }
}

describe("useScrollEdges", () => {
  beforeEach(() => {
    observers.length = 0
    vi.stubGlobal("ResizeObserver", FakeResizeObserver)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("has nothing past either edge before there is an element", () => {
    const hook = renderHook(() => useScrollEdges({ current: null }, 1))
    expect(hook.current).toEqual({ start: false, end: false })
    hook.unmount()
  })

  //at the start of the record there is nothing before it
  it("shows only the end fade at the top of a box that overflows", () => {
    const box = scroller({
      scrollHeight: 500,
      clientHeight: 100,
      scrollTop: 0,
    })
    const hook = renderHook(() => useScrollEdges({ current: box }, 1))
    expect(hook.current).toEqual({ start: false, end: true })
    hook.unmount()
  })

  it("shows both fades in the middle", () => {
    const box = scroller({
      scrollHeight: 500,
      clientHeight: 100,
      scrollTop: 200,
    })
    const hook = renderHook(() => useScrollEdges({ current: box }, 1))
    expect(hook.current).toEqual({ start: true, end: true })
    hook.unmount()
  })

  it("shows only the start fade at the bottom", () => {
    const box = scroller({
      scrollHeight: 500,
      clientHeight: 100,
      scrollTop: 400,
    })
    const hook = renderHook(() => useScrollEdges({ current: box }, 1))
    expect(hook.current).toEqual({ start: true, end: false })
    hook.unmount()
  })

  it("shows nothing for a box whose content fits", () => {
    const box = scroller({
      scrollHeight: 100,
      clientHeight: 100,
      scrollTop: 0,
    })
    const hook = renderHook(() => useScrollEdges({ current: box }, 1))
    expect(hook.current).toEqual({ start: false, end: false })
    hook.unmount()
  })

  //a box scrolled to its end lands on the max give or take a rounding error
  it("allows a pixel of slack for fractional scroll positions", () => {
    const atEnd = scroller({
      scrollHeight: 500,
      clientHeight: 100,
      scrollTop: 399.5,
    })
    const first = renderHook(() => useScrollEdges({ current: atEnd }, 1))
    expect(first.current.end).toBe(false)
    first.unmount()

    const nearStart = scroller({
      scrollHeight: 500,
      clientHeight: 100,
      scrollTop: 1,
    })
    const second = renderHook(() =>
      useScrollEdges({ current: nearStart }, 1),
    )
    expect(second.current.start).toBe(false)
    second.unmount()
  })

  it("updates as the box scrolls", () => {
    const box = scroller({
      scrollHeight: 500,
      clientHeight: 100,
      scrollTop: 0,
    })
    const hook = renderHook(() => useScrollEdges({ current: box }, 1))

    scrollTo(box, "scrollTop", 400)

    expect(hook.current).toEqual({ start: true, end: false })
    hook.unmount()
  })

  it("updates when the box is resized", () => {
    const box = scroller({
      scrollHeight: 500,
      clientHeight: 100,
      scrollTop: 0,
    })
    const hook = renderHook(() => useScrollEdges({ current: box }, 1))

    Object.assign(box, { clientHeight: 500 })
    act(() => observers[0]?.fire())

    expect(hook.current).toEqual({ start: false, end: false })
    hook.unmount()
  })

  it("reads the horizontal axis for the strip", () => {
    const box = scroller({
      scrollWidth: 900,
      clientWidth: 300,
      scrollLeft: 300,
    })
    const hook = renderHook(() => useScrollEdges({ current: box }, 1, "x"))
    expect(hook.current).toEqual({ start: true, end: true })
    hook.unmount()
  })

  it("measures again when the content changes", () => {
    const box = scroller({
      scrollHeight: 100,
      clientHeight: 100,
      scrollTop: 0,
    })
    const hook = renderHookWithProps<ScrollEdges, number>(
      (contentKey) => useScrollEdges({ current: box }, contentKey),
      1,
    )
    expect(hook.current.end).toBe(false)

    //a row appeared: neither scrolling nor resizing reports that
    Object.assign(box, { scrollHeight: 300 })
    hook.rerender(2)

    expect(hook.current.end).toBe(true)
    hook.unmount()
  })

  it("stops listening on unmount", () => {
    const box = scroller({
      scrollHeight: 500,
      clientHeight: 100,
      scrollTop: 0,
    })
    const hook = renderHook(() => useScrollEdges({ current: box }, 1))
    hook.unmount()
    expect(observers[0]?.disconnected).toBe(true)
  })
})
