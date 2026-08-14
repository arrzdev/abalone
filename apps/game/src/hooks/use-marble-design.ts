import { usePersistentState } from "@/hooks/use-persistent-state"
import type { MarbleDesign } from "@/render/marble-renderer"
import { hasDesign } from "@/render/marble-renderer"
import { PREF_PREFIX, parseStored, serialize } from "@/utils/preferences"

/**
 * Which marble the player has chosen, everywhere it is asked for.
 *
 * The game holds it, and so does the rules page, which draws its diagrams with
 * the player's own marbles rather than a stock illustration. One hook so the
 * key and the "is this still a design we ship?" check are written once.
 */
export function useMarbleDesign() {
  return usePersistentState<MarbleDesign>(
    `${PREF_PREFIX}marbleDesign`,
    "default",
    (raw) => {
      const saved = parseStored(raw)
      return typeof saved === "string" && hasDesign(saved) ? saved : null
    },
    serialize,
  )
}
