import { BOARD_SETUPS } from "@repo/abalone-engine/board-setups"
import { cellNames } from "@repo/abalone-engine/topology"
import type { Diagram } from "@/render/draw-diagram"

/**
 * The whole board in the standard opening, for the top of the rules page: the
 * first picture of the game a reader sees (rules-redesign §5 on TUD-893).
 *
 * Read from the engine's own opening, so it cannot drift from the board a game
 * starts on.
 */
export const START: Diagram = {
  cells: [...cellNames],
  marbles: Object.fromEntries([
    ...BOARD_SETUPS.standard.black.map(([r, q]) => [`${r},${q}`, "black"]),
    ...BOARD_SETUPS.standard.white.map(([r, q]) => [`${r},${q}`, "white"]),
  ]),
}
