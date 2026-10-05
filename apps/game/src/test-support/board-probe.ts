import { squareLabel } from "@repo/abalone-engine/notation"
import { cellNames } from "@repo/abalone-engine/topology"
import type { CellName, Player } from "@repo/abalone-engine/types"

/**
 * What the e2e suite can ask of the board. The board is a canvas, so there is
 * no element to click on and nothing to read a marble off; this answers both by
 * algebraic square ("e5"), the notation the move list already shows.
 *
 * It only says where to press. The press itself is a real pointer event on the
 * canvas, so a test goes through the same input path a player does.
 */
export type BoardProbe = {
  /** The viewport point at the centre of a square, or null if it names none. */
  point: (square: string) => { x: number; y: number } | null
  /** The colour of the marble on a square, or null for an empty one. */
  marble: (square: string) => Player | null
  /** Whether the board takes a move right now, or ignores a press. */
  takesInput: () => boolean
}

declare global {
  interface Window {
    __abaloneBoard?: BoardProbe
  }
}

const CELL_BY_SQUARE = new Map<string, CellName>(
  cellNames.map((name) => [squareLabel(name), name]),
)

type ProbeSource = {
  takesInput: () => boolean
  locate: (cell: CellName) => { x: number; y: number } | null
  marbleAt: (cell: CellName) => Player | null
}

/**
 * Puts the probe on `window` for the board that is being played on, and
 * returns the function that takes it back off. The e2e build only: the one
 * caller guards on `import.meta.env.MODE`, a constant at build time, so a
 * production build drops the call and this module with it.
 */
export function exposeBoardProbe(source: ProbeSource): () => void {
  const probe: BoardProbe = {
    point(square) {
      const cell = CELL_BY_SQUARE.get(square.toLowerCase())
      return cell ? source.locate(cell) : null
    },
    marble(square) {
      const cell = CELL_BY_SQUARE.get(square.toLowerCase())
      return cell ? source.marbleAt(cell) : null
    },
    takesInput: source.takesInput,
  }
  window.__abaloneBoard = probe
  return () => {
    if (window.__abaloneBoard === probe) window.__abaloneBoard = undefined
  }
}
