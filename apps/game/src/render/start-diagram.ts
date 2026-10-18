import type { SetupKey } from "@repo/abalone-engine/board-setups"
import { BOARD_SETUPS } from "@repo/abalone-engine/board-setups"
import { cellNames } from "@repo/abalone-engine/topology"
import type { Diagram } from "@/render/draw-diagram"

/**
 * The whole board in one opening, with no arrows or marks: a position, not a
 * move.
 *
 * Read from the engine's own openings, so a picture cannot drift from the board
 * a game starts on.
 */
export function setupDiagram(setup: SetupKey): Diagram {
  const { black, white } = BOARD_SETUPS[setup]
  return {
    cells: [...cellNames],
    marbles: Object.fromEntries([
      ...black.map(([r, q]) => [`${r},${q}`, "black"]),
      ...white.map(([r, q]) => [`${r},${q}`, "white"]),
    ]),
  }
}

/**
 * The standard opening, for the top of the rules page: the first picture of the
 * game a reader sees (rules-redesign §5 on TUD-893).
 */
export const START: Diagram = setupDiagram("standard")

/** The two daisy openings the starting positions page sets beside START. */
export const BELGIAN_DAISY: Diagram = setupDiagram("belgian_daisy")
export const GERMAN_DAISY: Diagram = setupDiagram("german_daisy")
