import {
  CELL_COUNT,
  cellNamed,
  NOWHERE,
  nameOf,
} from "#abalone-engine/topology"
import type {
  CellId,
  CellName,
  Player,
  Position,
  Side,
} from "#abalone-engine/types"

/**
 * A position: who stands where, and in what order each side's marbles are held.
 *
 * Two views of the same facts are kept side by side because both are wanted in
 * the inner loop and neither is cheap to derive from the other:
 *
 *   `occupant`  cell → side, for "what is on this square?" in one array read.
 *   `roster`    side → the cells it holds, for "walk my marbles" without a scan.
 *
 * Roster *order* is part of the position, not an accident of it. It is the
 * order the engine enumerates marbles in, so it decides which of several
 * equally-scored moves the search settles on. Marbles that move are taken out
 * and re-appended at the back, which is what `commit` does and what any other
 * writer must do too.
 */

export const VACANT = 0
export const BLACK = 1
export const WHITE = 2

/** The side that isn't this one. BLACK and WHITE are chosen so this is a flip. */
export const rival = (side: Side): Side => (side ^ 3) as Side

export const sideName = (side: Side): Player =>
  side === BLACK ? "black" : "white"

export const sideFromName = (name: Player): Side =>
  name === "black" ? BLACK : WHITE

/**
 * @param blackCells cell ids, in the order they should be held
 * @param whiteCells
 */
export function createPosition(
  blackCells: CellId[],
  whiteCells: CellId[],
): Position {
  const occupant = new Uint8Array(CELL_COUNT)
  for (const cell of blackCells) occupant[cell] = BLACK
  for (const cell of whiteCells) occupant[cell] = WHITE
  // Indexed by side, so `roster[occupant[cell]]` is always the right list.
  return { occupant, roster: [null, blackCells, whiteCells] }
}

/** Builds a position from `"r,q"` names, dropping anything that names no cell. */
export function positionFromNames(
  blackNames: Iterable<CellName>,
  whiteNames: Iterable<CellName>,
): Position {
  const toCells = (names: Iterable<CellName>) => {
    const cells: CellId[] = []
    for (const name of names) {
      const cell = cellNamed(name)
      if (cell !== NOWHERE) cells.push(cell)
    }
    return cells
  }
  return createPosition(toCells(blackNames), toCells(whiteNames))
}

/** The side's marbles as `"r,q"` names, in roster order. */
export const namesOf = (position: Position, side: Side): CellName[] =>
  position.roster[side].map(nameOf)

export const marbleCount = (position: Position, side: Side): number =>
  position.roster[side].length

/**
 * A string that identifies a position and side to move, and nothing else.
 *
 * The 61 cells fit in two 32-bit words per colour, so the signature is exact:
 * two positions share one only if they really are the same. That matters, since
 * this is what the repetition tables count and a collision there would invent a
 * draw out of nothing.
 */
export function signature(position: Position, sideToMove: Side): string {
  return stamp(position.roster[BLACK], position.roster[WHITE], sideToMove)
}

/** The same signature, for a stored snapshot that names its squares. */
export function signatureOfNames(
  blackNames: Iterable<CellName>,
  whiteNames: Iterable<CellName>,
  sideToMove: Player,
): string {
  const cells = (names: Iterable<CellName>) => {
    const out: CellId[] = []
    for (const name of names) {
      const cell = cellNamed(name)
      if (cell !== NOWHERE) out.push(cell)
    }
    return out
  }
  return stamp(cells(blackNames), cells(whiteNames), sideToMove)
}

//the side is only ever interpolated, so it may arrive either way round. the
//two callers keep separate tables, so their stamps never have to agree
function stamp(
  blackCells: CellId[],
  whiteCells: CellId[],
  sideToMove: Side | Player,
): string {
  let blackLow = 0
  let blackHigh = 0
  let whiteLow = 0
  let whiteHigh = 0

  for (const cell of blackCells) {
    if (cell < 32) blackLow |= 1 << cell
    else blackHigh |= 1 << (cell - 32)
  }
  for (const cell of whiteCells) {
    if (cell < 32) whiteLow |= 1 << cell
    else whiteHigh |= 1 << (cell - 32)
  }

  return `${blackLow},${blackHigh},${whiteLow},${whiteHigh},${sideToMove}`
}
