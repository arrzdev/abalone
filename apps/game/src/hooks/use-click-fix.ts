import type { MouseEvent, PointerEvent } from "react"
import { useCallback, useRef } from "react"

/**
 * Activation on release rather than on click, for controls that get tapped fast.
 *
 * iOS decides after the fact whether two quick taps were one gesture or two, and
 * holds the `click` back while it makes up its mind. In a standalone (home
 * screen) app it can then deliver that click against the element the *previous*
 * tap was on rather than the one the finger just touched. Three quick taps to
 * pick up three marbles is exactly the pattern that sets it off: the taps land
 * in the right places, the clicks arrive against the wrong ones, and the board
 * selects and deselects marbles nowhere near the finger.
 *
 * `pointerup` is neither held back nor retargeted, so that is what presses a
 * control here. Where the press started is remembered so that a drag is not
 * mistaken for a tap: a finger that has travelled further than TAP_SLOP was
 * scrolling the panel the control sits in, and scrolling must press nothing.
 *
 * The handlers come back as a props bundle — `<button {...useClickFix(fn)} />` —
 * rather than as the pair of them this started as, because two of the four are
 * not optional:
 *
 *   - `onPointerCancel`, or a press the browser takes away to pan with stays
 *     armed and goes off at the next release.
 *   - `onClick`, because a keyboard activation (Enter or Space on a focused
 *     control) and an assistive technology's press both arrive as a click with
 *     no pointer behind them. Dropping the click handler is what would break
 *     those; what gets dropped instead is the pointer's own echo of it.
 */

/** How far a pointer may travel between press and release and still be a tap, in CSS px. */
export const TAP_SLOP = 10

/**
 * How long after a tap a click is still taken to be that tap's echo, in ms.
 * Comfortably past the delay iOS adds while it waits to see whether a second tap
 * is coming, and short enough that it cannot swallow a later press of its own.
 */
const ECHO = 700

/**
 * When the last tap was pressed, for the whole app rather than per control.
 *
 * The click a tap is echoed by does not reliably arrive on the control that was
 * tapped — that misdirection is the bug being worked around — so a control has
 * to be able to recognise the echo of somebody else's tap as well as of its own.
 */
let lastTapAt = 0

/**
 * Records that a tap has just been dealt with on the pointer events.
 *
 * For anything handling its own pointers rather than using the hook — the board
 * canvas, which needs the press position for drag-selection anyway. Without it
 * the board's taps would be invisible to the controls around it, and a click
 * misdirected off the board onto one of them would press it.
 */
export function markTapHandled(): void {
  lastTapAt = Date.now()
}

/** Whether a click looks like the echo of a tap that has already been handled. */
export function isTapEcho(event: { detail: number }): boolean {
  // `detail` counts the clicks a pointing device made, so zero is a click that
  // nothing pointed with — the keyboard, or a screen reader. Those send no
  // pointerup and are the whole reason a click handler is still wired up.
  return event.detail !== 0 && Date.now() - lastTapAt < ECHO
}

/** What a pressed control is handed, whichever of the two events pressed it. */
export type TapEvent = PointerEvent<HTMLElement> | MouseEvent<HTMLElement>

export type TapHandler = (event: TapEvent) => void

export type TapHandlers = {
  onPointerDown: (event: PointerEvent<HTMLElement>) => void
  onPointerUp: (event: PointerEvent<HTMLElement>) => void
  onPointerCancel: () => void
  onClick: (event: MouseEvent<HTMLElement>) => void
}

export function useClickFix(callback?: TapHandler): TapHandlers {
  const pressRef = useRef<{ x: number; y: number } | null>(null)

  const onPointerDown = useCallback((event: PointerEvent<HTMLElement>) => {
    // The primary button only, and only the first finger down: the second one is
    // the start of a pinch, not a press.
    pressRef.current =
      event.button === 0 && event.isPrimary
        ? { x: event.clientX, y: event.clientY }
        : null
  }, [])

  const onPointerCancel = useCallback(() => {
    pressRef.current = null
  }, [])

  const onPointerUp = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      const press = pressRef.current
      pressRef.current = null
      if (!press || !callback) return
      if (Math.abs(event.clientX - press.x) > TAP_SLOP) return
      if (Math.abs(event.clientY - press.y) > TAP_SLOP) return

      markTapHandled()
      callback(event)
    },
    [callback],
  )

  const onClick = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      if (isTapEcho(event)) return
      callback?.(event)
    },
    [callback],
  )

  return { onPointerDown, onPointerUp, onPointerCancel, onClick }
}
