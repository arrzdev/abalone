import { useLayoutEffect, useState } from 'react';

/**
 * Height, in px, below which the panel gives up on the tall move list.
 *
 * It is the list's break-even point, added up: the panel's own padding (32), the
 * step buttons (44), the action bar (63), the gaps between them (16), and three
 * rows of moves (84) — fewer than three and the list is a slot you scroll one
 * move at a time, which is worse than no list at all.
 */
const COMPACT_BELOW = 240;

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
export const LIST_BELOW = 144;

/**
 * Whether the panel is at least this tall — the measurement everything else
 * here is made of.
 *
 * Measuring is safe, and this is the one thing worth checking before changing
 * any of it: the panel never sizes itself from its contents. Below `lg` it is a
 * `flex-1` item with a zero basis, taking whatever the header, the player cards
 * and the board leave over; beside the board it is a column in a row and takes
 * the full height. Either way, swapping one layout for another cannot change
 * the number this reads — so no two layouts can oscillate.
 *
 * It starts out saying yes, so the first render is the roomy one and a panel
 * that turns out to be short is corrected before the browser paints.
 */
export function usePanelFits(ref, minHeight) {
  const [fits, setFits] = useState(true);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;

    const measure = () => setFits(element.getBoundingClientRect().height >= minHeight);
    measure();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, minHeight]);

  return fits;
}

/**
 * Whether the side panel is too short to hold the move list, and should fall
 * back to the single-line strip.
 */
export function useCompactPanel(ref) {
  return !usePanelFits(ref, COMPACT_BELOW);
}
