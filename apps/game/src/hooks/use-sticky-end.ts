import type { RefObject } from "react"
import { useCallback, useEffect, useRef } from "react"

/**
 * How close to the end still counts as standing at it.
 *
 * Wider than the pixel of slack a fade needs, because this is a question about
 * a reader rather than about the geometry: a flick that stops a few pixels
 * short of the foot was a flick to the foot, and reading it as a step away
 * would leave the box refusing to follow anything ever again. Narrower than a
 * row, so that going up to look at the move before does count.
 */
const AT_END = 8

export type ScrollAxis = "x" | "y"

type AxisNames = {
  pos: "scrollTop" | "scrollLeft"
  span: "scrollHeight" | "scrollWidth"
  box: "clientHeight" | "clientWidth"
}

const AXES: Record<ScrollAxis, AxisNames> = {
  y: { pos: "scrollTop", span: "scrollHeight", box: "clientHeight" },
  x: { pos: "scrollLeft", span: "scrollWidth", box: "clientWidth" },
}

export type StickyEnd = {
  follow: () => void
  followIfPinned: () => void
}

/**
 * A scrolling box that follows what is added to its end — but only while the
 * reader is standing there.
 *
 * The bargain every message window makes: new lines arrive at the foot and the
 * view goes with them, unless you have gone up to read something, in which case
 * nothing moves under you until you come back down. Both halves matter. A box
 * that never follows makes you chase every arrival; one that always follows
 * takes the line you were reading away mid-word.
 *
 * `follow` goes to the end; `followIfPinned` goes only if the reader was
 * already there. Which of the two a caller wants is a question about what
 * arrived — an ordinary line is worth following, an announcement may be worth
 * interrupting a reader for — so it is left to the caller.
 *
 * Where the reader is standing is read off their scrolling, which is why
 * `follow` moves the box rather than animating it there. An animation is a
 * stream of scroll positions that are not at the end yet, and every one of them
 * looks exactly like a reader who has moved away — so the box would unpin
 * itself on the very scroll that was taking it to the foot. Telling the two
 * apart is guesswork; not producing the ambiguity is not. Nothing is lost by
 * it: what this follows is a line appearing at the end, and a jump of one line
 * is what a line appearing looks like.
 *
 * `contentKey` is anything that changes when the content does. The listener has
 * to be hung on an element that may not exist on the first render — an empty
 * record draws a line of text where the box would be — and a ref filled in
 * later is not something React re-runs an effect for.
 */
export function useStickyEnd(
  ref: RefObject<HTMLElement | null>,
  contentKey: unknown,
  axis: ScrollAxis = "y",
): StickyEnd {
  const { pos, span, box } = AXES[axis]
  const pinned = useRef(true)

  // biome-ignore lint/correctness/useExhaustiveDependencies: `contentKey` is a trigger, not something the effect reads — see above.
  useEffect(() => {
    const element = ref.current
    if (!element) return undefined

    // Scrolling is the only thing that answers this, and deliberately so. It is
    // not measured when the content changes, because at that moment the box is
    // one line taller than the reader last saw it and every pinned box in the
    // world looks a line short of its end — which is the state this exists to
    // scroll away. Where the reader last left it is the question, so their own
    // scrolling is the only thing that may answer it.
    const measure = () => {
      pinned.current =
        element[span] - element[pos] - element[box] <= AT_END
    }

    element.addEventListener("scroll", measure, { passive: true })
    return () => element.removeEventListener("scroll", measure)
  }, [box, contentKey, pos, ref, span])

  const follow = useCallback(() => {
    const element = ref.current
    if (!element) return
    // Assigning past the end is clamped to it, and is instant whatever
    // `scroll-behavior` the box has been given.
    element[pos] = element[span]
    pinned.current = true
  }, [pos, ref, span])

  const followIfPinned = useCallback(() => {
    if (pinned.current) follow()
  }, [follow])

  return { follow, followIfPinned }
}
