import type { RefObject } from "react"
import { useCallback, useEffect, useRef, useState } from "react"
import { prefersReducedMotion } from "@/render/motion"

/** A chapter is being read once its heading is in the top 30% of the scroller. */
const READING_BAND = 0.3

/** How long a jump may take when the browser never says it ended. */
const JUMP_FALLBACK_MS = 1000

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
      jumpingRef.current = true
      let fallback = 0
      const settle = () => {
        scroller.removeEventListener("scrollend", settle)
        window.clearTimeout(fallback)
        // after the last scroll frame, which may still be queued
        window.setTimeout(() => {
          jumpingRef.current = false
        }, 100)
      }
      scroller.addEventListener("scrollend", settle)
      fallback = window.setTimeout(settle, JUMP_FALLBACK_MS)

      const margin = Number.parseFloat(
        getComputedStyle(heading).scrollMarginTop,
      )
      const top =
        scroller.scrollTop +
        heading.getBoundingClientRect().top -
        scroller.getBoundingClientRect().top -
        (Number.isNaN(margin) ? 0 : margin)
      // the scroller, not `scrollIntoView`, which also scrolls the clipped
      // shell around it
      scroller.scrollTo({
        top,
        behavior: prefersReducedMotion() ? "auto" : "smooth",
      })
      // the address names the chapter, as the link it came from would
      history.replaceState(history.state, "", `#${id}`)
    },
    [scrollRef],
  )

  return { activeId, jumpTo }
}
