import { act } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useActiveChapter } from "@/hooks/use-active-chapter"
import { renderHook } from "@/test-support/render-hook"

//happy-dom lays nothing out, so the page is described by hand: the scroller is
//1000px tall with its top at 0, which puts the reading band at 300px, and each
//heading sits wherever the test last put it relative to the scroller's top
const IDS = ["intro", "setup", "moves"]
const SCROLLER_HEIGHT = 1000
const READING_BAND = 300

type Page = {
  scroller: HTMLElement
  headings: Record<string, HTMLElement>
}

function buildPage(): Page {
  const scroller = document.createElement("div")
  Object.defineProperties(scroller, {
    clientHeight: { value: SCROLLER_HEIGHT },
    scrollHeight: { value: 5000 },
  })
  scroller.scrollTop = 0
  scroller.getBoundingClientRect = () => ({ top: 0 }) as DOMRect
  document.body.appendChild(scroller)

  const headings: Record<string, HTMLElement> = {}
  for (const id of IDS) {
    const heading = document.createElement("h2")
    heading.id = id
    scroller.appendChild(heading)
    headings[id] = heading
  }
  return { scroller, headings }
}

function place(page: Page, tops: Record<string, number>) {
  for (const [id, top] of Object.entries(tops)) {
    //where it sits on the page: its place in the viewport moves with the scroll
    page.headings[id].getBoundingClientRect = () =>
      ({ top: top - page.scroller.scrollTop }) as DOMRect
  }
}

function scrollSpy(page: Page) {
  act(() => {
    page.scroller.dispatchEvent(new Event("scroll"))
    vi.advanceTimersByTime(20)
  })
}

function stubReducedMotion(reduced: boolean) {
  vi.stubGlobal("matchMedia", () => ({ matches: reduced }))
}

describe("useActiveChapter", () => {
  let page: Page

  beforeEach(() => {
    vi.useFakeTimers()
    stubReducedMotion(false)
    page = buildPage()
    place(page, { intro: 0, setup: 800, moves: 1600 })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    document.body.replaceChildren()
    history.replaceState(null, "", "/")
  })

  function mount() {
    return renderHook(() =>
      useActiveChapter({ current: page.scroller }, [...IDS]),
    )
  }

  describe("scroll-spy", () => {
    it("starts on the first chapter", () => {
      const hook = mount()
      expect(hook.current.activeId).toBe("intro")
      hook.unmount()
    })

    it("picks the last chapter whose heading has reached the reading band", () => {
      const hook = mount()

      place(page, { intro: -900, setup: -100, moves: READING_BAND + 1 })
      scrollSpy(page)
      expect(hook.current.activeId).toBe("setup")

      place(page, { intro: -1500, setup: -700, moves: READING_BAND })
      scrollSpy(page)
      expect(hook.current.activeId).toBe("moves")
      hook.unmount()
    })

    //above the first heading is still the first chapter
    it("stays on the first chapter while none has reached the band", () => {
      const hook = mount()

      place(page, { intro: 500, setup: 1300, moves: 2100 })
      scrollSpy(page)

      expect(hook.current.activeId).toBe("intro")
      hook.unmount()
    })

    it("reads the headings on mount, so a deep link starts on its chapter", () => {
      place(page, { intro: -900, setup: -100, moves: 700 })
      const hook = mount()
      expect(hook.current.activeId).toBe("setup")
      hook.unmount()
    })

    it("skips a heading that is not in the document", () => {
      const hook = renderHook(() =>
        useActiveChapter({ current: page.scroller }, ["intro", "missing"]),
      )
      place(page, { intro: -100 })
      scrollSpy(page)
      expect(hook.current.activeId).toBe("intro")
      hook.unmount()
    })

    it("stops listening on unmount", () => {
      const hook = mount()
      const removed = vi.spyOn(page.scroller, "removeEventListener")
      hook.unmount()
      expect(removed).toHaveBeenCalledWith("scroll", expect.any(Function))
    })
  })

  describe("jumpTo", () => {
    it("does nothing for a chapter that is not there", () => {
      const hook = mount()
      act(() => hook.current.jumpTo("nowhere"))
      expect(hook.current.activeId).toBe("intro")
      expect(page.scroller.scrollTop).toBe(0)
      hook.unmount()
    })

    it("marks the chapter, scrolls to it and writes it into the address", () => {
      stubReducedMotion(true)
      place(page, { intro: 0, setup: 800, moves: 1600 })
      const hook = mount()

      act(() => hook.current.jumpTo("setup"))

      expect(hook.current.activeId).toBe("setup")
      expect(page.scroller.scrollTop).toBe(800)
      expect(window.location.hash).toBe("#setup")
      hook.unmount()
    })

    //the scroll cannot go past the end of the content
    it("does not scroll past the end of the scroller", () => {
      stubReducedMotion(true)
      place(page, { intro: 0, setup: 800, moves: 9000 })
      const hook = mount()

      act(() => hook.current.jumpTo("moves"))

      expect(page.scroller.scrollTop).toBe(5000 - SCROLLER_HEIGHT)
      hook.unmount()
    })

    it("glides to the chapter over about 400ms", () => {
      const hook = mount()

      act(() => hook.current.jumpTo("setup"))
      expect(page.scroller.scrollTop).toBe(0)

      act(() => vi.advanceTimersByTime(200))
      expect(page.scroller.scrollTop).toBeGreaterThan(0)
      expect(page.scroller.scrollTop).toBeLessThan(800)

      act(() => vi.advanceTimersByTime(300))
      expect(page.scroller.scrollTop).toBe(800)
      hook.unmount()
    })

    //a short chapter ends with the next heading inside the band too, and the
    //reader asked for this one
    it("keeps the mark on the pressed chapter while the glide passes others", () => {
      const hook = mount()
      act(() => hook.current.jumpTo("setup"))

      place(page, { intro: -2000, setup: -1200, moves: 100 })
      scrollSpy(page)

      expect(hook.current.activeId).toBe("setup")
      hook.unmount()
    })

    it("hands the mark back to the scroll shortly after the glide ends", () => {
      const hook = mount()
      act(() => hook.current.jumpTo("setup"))
      act(() => vi.advanceTimersByTime(500))

      place(page, { intro: -2000, setup: -1200, moves: 100 })
      scrollSpy(page)

      expect(hook.current.activeId).toBe("moves")
      hook.unmount()
    })

    it("stops gliding when the reader takes the scroll back", () => {
      const hook = mount()
      act(() => hook.current.jumpTo("setup"))
      act(() => vi.advanceTimersByTime(100))
      const stoppedAt = page.scroller.scrollTop

      act(() => {
        page.scroller.dispatchEvent(new Event("wheel"))
        vi.advanceTimersByTime(400)
      })

      expect(page.scroller.scrollTop).toBe(stoppedAt)
      hook.unmount()
    })

    it("lets a second jump cut the first one short", () => {
      const hook = mount()
      act(() => hook.current.jumpTo("moves"))
      act(() => vi.advanceTimersByTime(100))

      act(() => hook.current.jumpTo("setup"))
      act(() => vi.advanceTimersByTime(500))

      expect(hook.current.activeId).toBe("setup")
      expect(page.scroller.scrollTop).toBe(800)
      hook.unmount()
    })
  })
})
