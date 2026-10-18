import { usePersistentState } from "@/hooks/use-persistent-state"
import type { BoardTheme } from "@/render/board-themes"
import { DEFAULT_BOARD_THEME, hasBoardTheme } from "@/render/board-themes"
import { PREF_PREFIX, parseStored, serialize } from "@/utils/preferences"

/**
 * Which board theme the player has chosen, everywhere a board is painted.
 *
 * A local preference like the marble design: it is paint on this one device,
 * so it is never sent anywhere and needs no account. A value this build does not
 * know, or one that will not parse, reads as Slate.
 */
export function useBoardTheme() {
  return usePersistentState<BoardTheme>(
    `${PREF_PREFIX}boardTheme`,
    DEFAULT_BOARD_THEME,
    (raw) => {
      const saved = parseStored(raw)
      return typeof saved === "string" && hasBoardTheme(saved)
        ? saved
        : null
    },
    serialize,
  )
}
