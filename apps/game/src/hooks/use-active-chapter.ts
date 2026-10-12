import type { RefObject } from "react"
import { useCallback, useEffect, useRef, useState } from "react"
import { easeInOutCubic, prefersReducedMotion } from "@/render/motion"

/**
 * A chapter is being read once its heading is in the top 30% of the scroller:
 * the band an observer with `rootMargin: "0px 0px -70% 0px"` watches.
 */
const READING_BAND = 0.3

/** A jump's length, whatever the distance: long enough to see where it went. */
const JUMP_MS = 400

/** What a reader does to take the scroll back during a jump. */
const TAKE_BACK = [
  "wheel",
  "touchstart",
  "pointerdown",
  "keydown",
] as const

/**
 * Scrolls `scroller` to `top` frame by frame, and stops early when the reader
 * takes the scroll back. Driven here rather than by `behavior: "smooth"`, whose
 * length is the browser's to pick and which some engines skip entirely.
 *
 * Returns a function that stops it.
 */
function glide(scroller: HTMLElement, top: number, done: () => void) {
  const from = scroller.scrollTop
  const start = performance.now()
  let frame = requestAnimationFrame(function step(now) {
    const progress = Math.min(1, (now - start) / JUMP_MS)
    scroller.scrollTop = from + (top - from) * easeInOutCubic(progress)
    if (progress < 1) frame = requestAnimationFrame(step)
    else stop()
  })
  function stop() {
    cancelAnimationFrame(frame)
    for (const type of TAKE_BACK) scroller.removeEventListener(type, stop)
    done()
  }
  for (const type of TAKE_BACK)
    scroller.addEventListener(type, stop, { passive: true })
  return stop
}

/** The last chapter whose heading has reached the reading band, or the first. */
function chapterBeingRead(scroller: HTMLElement, ids: string[]): string {
  const band =
    scroller.getBoundingClientRect().top +
    scroller.clientHeight * READING_BAND
  let reading = ids[0]
  for (const id of ids) {
    const heading = document.getElementById(id)
    if (heading && heading.getBoundingClientRect().top <= band)
      reading = id
  }
  return reading
}

/**
 * Scroll-spy for a manual page (the `rules-redesign` document on TUD-893, §7):
 * which chapter is being read, and a jump to a chapter that marks it at once.
 *
 * Read from the headings' positions on scroll rather than tallied from
 * intersection events, so a jump of any length lands on the right answer.
 * While a jump glides past other chapters the mark stays on the one pressed:
 * a short chapter ends with the next heading inside the band too, and the
 * reader asked for this one.
 */
export function useActiveChapter(
  scrollRef: RefObject<HTMLElement | null>,
  ids: string[],
) {
  const [activeId, setActiveId] = useState(ids[0])
  const jumpingRef = useRef(false)
  const cancelJumpRef = useRef<() => void>(() => {})
  const idsKey = ids.join(" ")

  // biome-ignore lint/correctness/useExhaustiveDependencies: `idsKey` stands for `ids`, a new array on every render with the same chapters in it.
  useEffect(() => {
    const scroller = scrollRef.current
    if (!scroller) return
    let frame = 0
    const update = () => {
      frame = 0
      if (jumpingRef.current) return
      setActiveId(chapterBeingRead(scroller, ids))
    }
    const onScroll = () => {
      if (frame === 0) frame = requestAnimationFrame(update)
    }
    update()
    scroller.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      scroller.removeEventListener("scroll", onScroll)
      cancelAnimationFrame(frame)
    }
  }, [scrollRef, idsKey])

  const jumpTo = useCallback(
    (id: string) => {
      const scroller = scrollRef.current
      const heading = document.getElementById(id)
      if (!scroller || !heading) return

      setActiveId(id)
      const margin = Number.parseFloat(
        getComputedStyle(heading).scrollMarginTop,
      )
      const target = Math.min(
        scroller.scrollHeight - scroller.clientHeight,
        scroller.scrollTop +
          heading.getBoundingClientRect().top -
          scroller.getBoundingClientRect().top -
          (Number.isNaN(margin) ? 0 : margin),
      )
      // the address names the chapter, as the link it came from would
      history.replaceState(history.state, "", `#${id}`)

      cancelJumpRef.current()
      if (prefersReducedMotion()) {
        scroller.scrollTop = target
        return
      }
      jumpingRef.current = true
      cancelJumpRef.current = glide(scroller, target, () => {
        cancelJumpRef.current = () => {}
        // after the last frame's scroll event, which is still to come
        window.setTimeout(() => {
          jumpingRef.current = false
        }, 100)
      })
    },
    [scrollRef],
  )

  return { activeId, jumpTo }
}
