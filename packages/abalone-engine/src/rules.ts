import { MAX_LINE } from "#abalone-engine/config"
import {
  commitMove,
  destinationsFor,
  isUnbrokenLine,
  orderLine,
  resolveMove,
} from "#abalone-engine/moves"
import {
  BLACK,
  namesOf,
  positionFromNames,
  WHITE,
} from "#abalone-engine/position"
import {
  cellNamed,
  HEADING_STEPS,
  HEADINGS,
  headingBetween,
  NOWHERE,
  nameBeyond,
  nameOf,
  neighbour,
} from "#abalone-engine/topology"
import type {
  AxialStep,
  Board,
  CellId,
  CellName,
  Player,
  Side,
} from "#abalone-engine/types"

/**
 * The seam between the board people play on and the engine that reasons about it.
 *
 * Everything above this file — React state, the move history, the renderer,
 * saved preferences — addresses squares by name: the `"r,q"` strings that have
 * always been the board's public vocabulary. Everything below it works in cell
 * ids and typed arrays. Each function here translates one way, asks the rules a
 * question, and translates back.
 *
 * A *board* is `{ black: Set<string>, white: Set<string> }`; a game state
 * satisfies that shape, which is why states can be passed straight in.
 */

/** One marble on its way somewhere, as the canvas wants it. */
export type MovingMarble = {
  from: CellName
  to: CellName
  color: string
}

/** Everything the rest of the app needs to know about a move just played. */
export type MoveOutcome = {
  board: Board
  blackScoreDelta: number
  whiteScoreDelta: number
  direction: AxialStep
  shovedMarbles: CellName[]
  marbleCount: number
  isPush: boolean
  isCapture: boolean
  movingMarbles: MovingMarble[]
}

/** Marble colours as the canvas wants them. */
const INK = "#333"
const BONE = "#fff"

const sideOf = (isBlackTurn: boolean): Side =>
  isBlackTurn ? BLACK : WHITE

/** Which side stands on a named square, if any. */
export function marbleAt(board: Board, name: CellName): Player | null {
  if (board.black.has(name)) return "black"
  if (board.white.has(name)) return "white"
  return null
}

/** The single step from one named square to a neighbouring one, else null. */
export function directionBetween(
  fromName: CellName,
  toName: CellName,
): AxialStep | null {
  const from = cellNamed(fromName)
  const to = cellNamed(toName)
  if (from === NOWHERE || to === NOWHERE) return null

  const heading = headingBetween(from, to)
  if (heading === NOWHERE) return null

  const [dr, dq] = HEADING_STEPS[heading]
  return [dr, dq]
}

/** One step apart, on any of the three axes. */
const neighbours = (a: CellName, b: CellName) =>
  directionBetween(a, b) !== null

/** Named squares to cell ids, or null if any of them names nothing. */
function toCells(names: Iterable<CellName>): CellId[] | null {
  const cells: CellId[] = []
  for (const name of names) {
    const cell = cellNamed(name)
    if (cell === NOWHERE) return null
    cells.push(cell)
  }
  return cells
}

//---- picking marbles up ---------------------------------------------

/**
 * Whether these squares hold a line that could be picked up — used to vet a
 * selection as it grows, before there is any question of moving it.
 */
export function formsLine(names: CellName[]): boolean {
  if (names.length > MAX_LINE) return false
  if (names.length <= 2) return true // a pair is vetted by adjacency, not here
  const cells = toCells(names)
  return cells !== null && isUnbrokenLine(orderLine(cells))
}

/**
 * The selection after clicking a marble that was not already in it.
 *
 * Anything that would not extend the current line — the wrong colour, out of
 * reach, off the axis, or a fourth marble — starts a new selection from the
 * marble just clicked, which is nearly always what was meant by the click.
 */
export function selectMarble(
  board: Board,
  selected: CellName[],
  name: CellName,
  color: Player,
): CellName[] {
  if (selected.length === 0) return [name]
  if (selected.length >= MAX_LINE) return [name]

  const leadColor = board.black.has(selected[0]) ? "black" : "white"
  if (color !== leadColor) return [name]
  if (!selected.some((held) => neighbours(held, name))) return [name]

  const grown = [...selected, name]
  return formsLine(grown) ? grown : [name]
}

/** The selection after clicking a marble that was already in it. */
export function deselectMarble(
  selected: CellName[],
  name: CellName,
): CellName[] {
  const brokenMiddle =
    selected.length === 3 &&
    name === selected[1] &&
    neighbours(selected[0], selected[1]) &&
    neighbours(selected[1], selected[2]) &&
    !neighbours(selected[0], selected[2])

  // Taking the join out of a bent selection would leave two marbles that are
  // not a line, so the click restarts from the one that was clicked instead.
  if (brokenMiddle) return [name]

  return selected.filter((held) => held !== name)
}

/**
 * The whole run from `anchor` through to `reach`, for dragging a selection out
 * with the mouse rather than clicking each marble.
 *
 * Unlike `selectMarble` this is absolute, not incremental: it is derived from
 * the two ends every time, so dragging back over a run shrinks it again and a
 * wobble across a neighbouring line cannot strand a marble.
 *
 * Returns null when the ends describe nothing legal — off the axes, too far
 * apart, or with a gap or an opponent in between. The caller keeps whatever run
 * it already had, which is what makes overshooting the end of a line feel like
 * stopping there rather than losing the selection.
 */
export function selectRun(
  board: Board,
  anchor: CellName,
  reach: CellName,
): CellName[] | null {
  const from = cellNamed(anchor)
  const to = cellNamed(reach)
  if (from === NOWHERE || to === NOWHERE) return null

  const color = marbleAt(board, anchor)
  if (!color) return null
  if (from === to) return [anchor]

  for (let heading = 0; heading < HEADINGS; heading++) {
    let cursor = from
    const run = [anchor]
    for (let reached = 1; reached < MAX_LINE; reached++) {
      cursor = neighbour(cursor, heading)
      if (cursor === NOWHERE) break
      run.push(nameOf(cursor))
      if (cursor !== to) continue
      return run.every((name) => marbleAt(board, name) === color)
        ? run
        : null
    }
  }
  return null
}

//---- moving them ----------------------------------------------------

/**
 * Every square the current selection may move onto.
 *
 * The selection arrives in whatever order it was clicked or dragged, so it is
 * put end to end first; anything that is not an unbroken line has nowhere to go.
 */
export function getPossibleMoves(
  board: Board,
  selected: CellName[] | null | undefined,
  isBlackTurn: boolean,
): CellName[] {
  if (!selected || selected.length === 0) return []

  const cells = toCells(selected)
  if (cells === null) return []

  const line = orderLine(cells)
  if (!isUnbrokenLine(line)) return []

  const position = positionFromNames(board.black, board.white)
  return destinationsFor(position, line, sideOf(isBlackTurn)).map(nameOf)
}

/**
 * Plays a move and reports everything the rest of the app needs to know about
 * it: the board it leads to, what the animation should show, and enough detail
 * for the move list to describe it.
 *
 * The selection keeps the order it was given, because that is the order the
 * marbles animate in and the order they take up in the new board.
 */
export function applyMove(
  board: Board,
  selected: CellName[],
  targetName: CellName,
  isBlackTurn: boolean,
): MoveOutcome | null {
  const line = toCells(selected)
  const target = cellNamed(targetName)
  if (line === null || line.length === 0 || target === NOWHERE) return null

  const side = sideOf(isBlackTurn)
  const position = positionFromNames(board.black, board.white)

  const plan = resolveMove(position, line, target, side)
  if (!plan) return null

  const outcome = commitMove(
    position,
    line,
    plan.heading,
    plan.shoved,
    side,
  )
  if (!outcome) return null

  const [dr, dq] = HEADING_STEPS[plan.heading]
  const mine = side === BLACK ? INK : BONE
  const theirs = side === BLACK ? BONE : INK

  return {
    board: {
      black: new Set(namesOf(outcome.position, BLACK)),
      white: new Set(namesOf(outcome.position, WHITE)),
    },
    blackScoreDelta: side === BLACK ? outcome.captured : 0,
    whiteScoreDelta: side === WHITE ? outcome.captured : 0,
    direction: [dr, dq],
    shovedMarbles: plan.shoved.map(nameOf),
    marbleCount: line.length,
    isPush: plan.shoved.length > 0,
    isCapture: outcome.captured > 0,
    movingMarbles: [
      ...line.map((cell, i) => ({
        from: nameOf(cell),
        to: nameOf(outcome.landings[i]),
        color: mine,
      })),
      // A captured marble is animated to where it *would* have landed, which is
      // a square off the board — so it is named rather than looked up.
      ...plan.shoved.map((cell, i) => ({
        from: nameOf(cell),
        to:
          outcome.shovedTo[i] === NOWHERE
            ? nameBeyond(cell, plan.heading)
            : nameOf(outcome.shovedTo[i]),
        color: theirs,
      })),
    ],
  }
}

/** Where a run of marbles ends up after stepping once in `direction`. */
export function shiftNames(
  names: CellName[],
  direction: AxialStep,
): CellName[] {
  const [dr, dq] = direction
  return names.map((name) => {
    const [r, q] = name.split(",").map(Number)
    return `${r + dr},${q + dq}`
  })
}
