import {
  CELL_COUNT,
  cellCol,
  cellNamed,
  cellRow,
  NOWHERE,
  separation,
} from "@/engine/topology"
import type { CellName } from "@/engine/types"

/**
 * Abalone's algebraic notation.
 *
 * Rows are lettered a–i from the top of the board down, columns numbered 1–9
 * from the left, so the centre square is e5. A move is written as the square
 * the line starts from followed by the square it ends on — "d7c7" — where "the
 * square it starts from" means the marble furthest from the destination, since
 * that is the one whose journey describes the whole line's.
 *
 * Every square's label is worked out once; reading one back is an array index.
 */

const LABELS: string[] = new Array(CELL_COUNT)
for (let cell = 0; cell < CELL_COUNT; cell++) {
  LABELS[cell] = `${String.fromCharCode(97 + 4 - cellRow[cell])}${
    cellCol[cell] + 5
  }`
}

/** The algebraic label for a `"r,q"` square, or '' if it names none. */
export function squareLabel(name: CellName): string {
  const cell = cellNamed(name)
  return cell === NOWHERE ? "" : LABELS[cell]
}

/**
 * A move written out, e.g. "d7c7".
 * @param marbles the line that moved, in any order
 * @param destination the square it moved onto
 */
export function formatMoveAlgebraic(
  marbles: CellName[],
  destination: CellName,
): string {
  if (!marbles?.length || !destination) return ""

  const target = cellNamed(destination)
  if (target === NOWHERE) return ""

  let trailing = cellNamed(marbles[0])
  if (trailing === NOWHERE) return ""
  let furthest = separation(trailing, target)

  for (let i = 1; i < marbles.length; i++) {
    const cell = cellNamed(marbles[i])
    if (cell === NOWHERE) continue
    const distance = separation(cell, target)
    if (distance > furthest) {
      furthest = distance
      trailing = cell
    }
  }

  return `${LABELS[trailing]}${LABELS[target]}`
}
