import type { RefObject } from "react"
import { useLayoutEffect, useState } from "react"

/**
 * Height, in px, below which the panel gives up on the tall move list.
 *
 * It is the list's break-even point, added up: the panel's own padding (24 — 8
 * at the top, which is the gap under the seats, and 16 at the bottom), the step
 * buttons (44), the action bar (63), the gaps between them (16), and three rows
 * of moves (84) — fewer than three and the list is a slot you scroll one move at
 * a time, which is worse than no list at all.
 */
const COMPACT_BELOW = 232

/**
 * Height, in px, below which the history has to be the single-line strip: the
 * panel's padding (16), the gap (8), the row of actions along the bottom (64)
 * and two rows of moves (56). Under two rows a list is a slot you scroll one
 * move at a time, and the chips say more in the same space.
 *
 * One number for the game and for the end of it, measured on the taller of the
 * two rows that sit down there — the in-game actions; the rematch buttons that
 * replace them are a little shorter. The list is not the layout's to change on
 * the last move of the game: it appears and goes at one panel height, and the
 * game ending is not one of the things that can move it.
 */
export const LIST_BELOW = 144

/**
 * The least the controls at the foot of the panel can be, in px, on top of
 * whatever the seat card above them turns out to be: the column's top padding
 * (8), the move strip (40), the gap (8), and the row of actions (64), plus the
 * 8 of the bottom padding that is not the safe-area inset. The inset is added in
 * CSS, where it can be read.
 *
 * The strip and the action bar, because that is the shortest the foot of this
 * panel ever legitimately gets: the strip is the history's smallest rendering
 * and the action bar is a fixed 64 that never gives anything up. Measured on
 * the in-game bar rather than the rematch row that replaces it, for the same
 * reason as {@link LIST_BELOW} — it is the taller of the two.
 *
 * What it is for: below `lg` the panel is a `flex-1` with a zero basis, so it
 * takes what the board leaves over and no more. On a short screen that is less
 * than the controls need, and what happens then is not a shorter panel but a
 * clipped one — the action bar disappears under the bottom edge with nothing
 * saying so. The board is the elastic one here: it is a canvas that letterboxes
 * into whatever box it is given, and the row of actions is not. So the panel
 * carries a floor and the board shrinks to clear it.
 */
export const CONTROLS_FLOOR = 128

/**
 * The panel's floor as a CSS length: whatever its fixed head measures, plus
 * {@link CONTROLS_FLOOR} and the safe-area inset.
 *
 * Measured rather than tabulated because the head is not one height. It is the
 * seat card, which is short in a hot-seat game, taller where a bot or an
 * opponent has a line to say, and taller again online where the head-to-head
 * record sits under the score — and online it carries the sync notice as well.
 *
 * Measuring it cannot oscillate the way measuring the whole panel would: none of
 * that depends on how tall the panel is. The card is `shrink-0` and sizes itself
 * from its own contents, so it reads the same height whether the panel has room
 * for it or is clipping it.
 *
 * A callback ref rather than an object one, and it is the whole reason this is
 * not shaped like {@link usePanelFits}: the head is not on the screen for the
 * whole of the panel's life. Pregame has no seat card, so on the first render
 * there is nothing to measure — and a `RefObject` filled in later is not a
 * render, so an effect keyed on it never runs again and the floor stays at the
 * controls alone. Handing the node to state is what makes it appearing an event
 * this can see.
 */
export function usePanelFloor(): {
  /** Put this on the panel's fixed head — the seat card and anything under it. */
  ref: (node: HTMLElement | null) => void
  /** The floor, ready for a `min-height`. */
  floor: string
} {
  const [head, setHead] = useState(0)
  const [node, setNode] = useState<HTMLElement | null>(null)

  useLayoutEffect(() => {
    if (!node) {
      //no head on the screen is a head of no height, not the last one measured
      setHead(0)
      return
    }

    const measure = () => setHead(node.getBoundingClientRect().height)
    measure()

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure)
      return () => window.removeEventListener("resize", measure)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [node])

  return {
    ref: setNode,
    floor: `calc(${head + CONTROLS_FLOOR}px + env(safe-area-inset-bottom))`,
  }
}

/**
 * Whether the panel is at least this tall — the measurement everything else
 * here is made of.
 *
 * Measuring is safe, and this is the one thing worth checking before changing
 * any of it: the panel never sizes itself from its contents. Below `lg` it is a
 * `flex-1` item with a zero basis, taking whatever the header and the board
 * leave over; beside the board it is a column in a row and takes the full
 * height. Either way, swapping one layout for another cannot change the number
 * this reads — so no two layouts can oscillate.
 *
 * It starts out saying yes, so the first render is the roomy one and a panel
 * that turns out to be short is corrected before the browser paints.
 */
export function usePanelFits(
  ref: RefObject<HTMLElement | null>,
  minHeight: number,
): boolean {
  const [fits, setFits] = useState(true)

  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return

    const measure = () =>
      setFits(element.getBoundingClientRect().height >= minHeight)
    measure()

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure)
      return () => window.removeEventListener("resize", measure)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref, minHeight])

  return fits
}

/**
 * Whether the side panel is too short to hold the move list, and should fall
 * back to the single-line strip.
 */
export function useCompactPanel(
  ref: RefObject<HTMLElement | null>,
): boolean {
  return !usePanelFits(ref, COMPACT_BELOW)
}
