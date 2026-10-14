import type { RefObject } from "react"
import { useLayoutEffect, useState } from "react"
import type { ScrollAxis } from "@/hooks/use-sticky-end"
import { SCROLL_AXES } from "@/hooks/use-sticky-end"

/** Whether there is content past each end: start is the top or the left. */
export type ScrollEdges = { start: boolean; end: boolean }

/**
 * Whether a scrolling box has anything left before it and after it, along one
 * axis — above and below for the move list, left and right for the strip.
 *
 * What it is for is the pair of fades at the ends of the move history: a box
 * that scrolls has to say so, and the only honest way to say it is to show that
 * the content runs past the edge. So each end answers for itself — at the start
 * of the record there is nothing before it, and the fade there would be a mark
 * drawn over content that is all there.
 *
 * The single pixel of slack is for fractional scroll positions: a box scrolled
 * to its end lands on `scrollHeight - clientHeight` give or take a rounding
 * error, and without it the end fade never quite goes out.
 *
 * `contentKey` is anything that changes when the content does — a length is
 * usually it. Scrolling and resizing are watched for; a row appearing is not
 * something either of those reports, and it changes the answer.
 */
export function useScrollEdges(
  ref: RefObject<HTMLElement | null>,
  contentKey: unknown,
  axis: ScrollAxis = "y",
): ScrollEdges {
  const { pos, span, box } = SCROLL_AXES[axis]
  const [edges, setEdges] = useState<ScrollEdges>({
    start: false,
    end: false,
  })

  // biome-ignore lint/correctness/useExhaustiveDependencies: `contentKey` is a trigger, not something the effect reads — see above.
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return

    const measure = () => {
      const max = element[span] - element[box]
      const start = element[pos] > 1
      const end = element[pos] < max - 1
      // Scrolling fires this on every frame of a drag, and all but two of those
      // frames say what the last one said.
      setEdges((prev) =>
        prev.start === start && prev.end === end ? prev : { start, end },
      )
    }
    measure()

    element.addEventListener("scroll", measure, { passive: true })
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure)
      return () => {
        element.removeEventListener("scroll", measure)
        window.removeEventListener("resize", measure)
      }
    }
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => {
      element.removeEventListener("scroll", measure)
      observer.disconnect()
    }
  }, [box, contentKey, pos, ref, span])

  return edges
}
