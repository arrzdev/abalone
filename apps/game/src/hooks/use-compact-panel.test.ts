import { act } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  CONTROLS_FLOOR,
  useCompactPanel,
  usePanelFits,
  usePanelFloor,
} from "@/hooks/use-compact-panel"
import { renderHook } from "@/test-support/render-hook"

//happy-dom lays nothing out, so a box is as tall as the test says it is
function boxOf(height: number): HTMLElement {
  const element = document.createElement("div")
  setHeight(element, height)
  return element
}

function setHeight(element: HTMLElement, height: number) {
  element.getBoundingClientRect = () => ({ height }) as DOMRect
}

//a column: the parent, the panel the hook watches, and whatever sits beside it
function column(options: {
  parent: number
  panel: number
  sibling?: number
}) {
  const parent = boxOf(options.parent)
  const panel = boxOf(options.panel)
  parent.appendChild(panel)
  if (options.sibling !== undefined)
    parent.appendChild(boxOf(options.sibling))
  document.body.appendChild(parent)
  return { parent, panel }
}

//stands in for the browser's observer, so a test can say "the box changed size"
const observers: FakeResizeObserver[] = []

class FakeResizeObserver {
  observed: Element[] = []
  disconnected = false

  constructor(private readonly callback: () => void) {
    observers.push(this)
  }

  observe(element: Element) {
    this.observed.push(element)
  }

  disconnect() {
    this.disconnected = true
  }

  fire() {
    this.callback()
  }
}

describe("compact panel measurements", () => {
  beforeEach(() => {
    observers.length = 0
    vi.stubGlobal("ResizeObserver", FakeResizeObserver)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    document.body.replaceChildren()
  })

  describe("usePanelFits", () => {
    it("says yes before anything has been measured", () => {
      const hook = renderHook(() => usePanelFits({ current: null }, 200))
      expect(hook.current).toBe(true)
      hook.unmount()
    })

    //the room is the parent's height less everything else in it
    it("measures the room left beside the other children", () => {
      const { panel } = column({ parent: 500, panel: 10, sibling: 300 })

      const fits = renderHook(() => usePanelFits({ current: panel }, 200))
      const short = renderHook(() => usePanelFits({ current: panel }, 201))

      expect(fits.current).toBe(true)
      expect(short.current).toBe(false)
      fits.unmount()
      short.unmount()
    })

    //the room never depends on the panel's own contents
    it("ignores the panel's own height", () => {
      const { panel } = column({ parent: 500, panel: 9999, sibling: 300 })

      const hook = renderHook(() => usePanelFits({ current: panel }, 200))

      expect(hook.current).toBe(true)
      hook.unmount()
    })

    it("uses the panel's own box when it has no parent", () => {
      const panel = boxOf(120)
      const hook = renderHook(() => usePanelFits({ current: panel }, 100))
      expect(hook.current).toBe(true)
      hook.unmount()
    })

    it("measures again when the parent or a sibling resizes", () => {
      const { parent, panel } = column({
        parent: 500,
        panel: 10,
        sibling: 300,
      })
      const hook = renderHook(() => usePanelFits({ current: panel }, 200))
      expect(hook.current).toBe(true)

      setHeight(parent, 400)
      act(() => observers[0]?.fire())

      expect(hook.current).toBe(false)
      expect(observers[0]?.observed).toContain(parent)
      expect(observers[0]?.observed).toContain(parent.children[1])
      hook.unmount()
    })

    it("falls back to the window's resize when there is no observer", () => {
      vi.stubGlobal("ResizeObserver", undefined)
      const { parent, panel } = column({ parent: 500, panel: 10 })
      const hook = renderHook(() => usePanelFits({ current: panel }, 200))

      setHeight(parent, 100)
      act(() => {
        window.dispatchEvent(new Event("resize"))
      })

      expect(hook.current).toBe(false)
      hook.unmount()
    })

    it("stops watching on unmount", () => {
      const { panel } = column({ parent: 500, panel: 10 })
      const hook = renderHook(() => usePanelFits({ current: panel }, 200))
      hook.unmount()
      expect(observers[0]?.disconnected).toBe(true)
    })
  })

  describe("useCompactPanel", () => {
    it("is compact only when the room is under the list's break-even", () => {
      const roomy = column({ parent: 248, panel: 10 })
      const tight = column({ parent: 247, panel: 10 })

      const roomyHook = renderHook(() =>
        useCompactPanel({ current: roomy.panel }),
      )
      const tightHook = renderHook(() =>
        useCompactPanel({ current: tight.panel }),
      )

      expect(roomyHook.current).toBe(false)
      expect(tightHook.current).toBe(true)
      roomyHook.unmount()
      tightHook.unmount()
    })
  })

  describe("usePanelFloor", () => {
    it("is the controls alone while there is no head to measure", () => {
      const hook = renderHook(usePanelFloor)
      expect(hook.current.head).toBe(0)
      expect(hook.current.floor).toBe(
        `calc(${CONTROLS_FLOOR}px + env(safe-area-inset-bottom))`,
      )
      hook.unmount()
    })

    it("adds what the head measures to the controls' floor", () => {
      const hook = renderHook(usePanelFloor)

      act(() => hook.current.ref(boxOf(90)))

      expect(hook.current.head).toBe(90)
      expect(hook.current.floor).toBe(
        `calc(${90 + CONTROLS_FLOOR}px + env(safe-area-inset-bottom))`,
      )
      hook.unmount()
    })

    it("follows the head as it changes height", () => {
      const head = boxOf(90)
      const hook = renderHook(usePanelFloor)
      act(() => hook.current.ref(head))

      setHeight(head, 120)
      act(() => observers[0]?.fire())

      expect(hook.current.head).toBe(120)
      hook.unmount()
    })

    //pregame has no seat card: no head is a head of no height, not the last one
    it("drops back to zero when the head leaves the screen", () => {
      const hook = renderHook(usePanelFloor)
      act(() => hook.current.ref(boxOf(90)))

      act(() => hook.current.ref(null))

      expect(hook.current.head).toBe(0)
      hook.unmount()
    })
  })
})
