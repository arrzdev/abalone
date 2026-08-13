import { MAX_LINE } from "@/engine/config"
import { rival, VACANT } from "@/engine/position"
import {
  CANONICAL_HEADING,
  HEADINGS,
  headingBetween,
  NOWHERE,
  neighbour,
  reverse,
  veer,
} from "@/engine/topology"
import type {
  CellId,
  Heading,
  Position,
  Roster,
  Side,
} from "@/engine/types"

/**
 * The rules of Abalone, expressed over cell ids.
 *
 * One to three marbles standing in a row form a *line*. A line travels either
 * along its own axis — an **in-line** move, the only kind that can shove the
 * opponent — or square-on to it, a **broadside**, which needs every destination
 * empty. A shove (*sumito*) succeeds while the pushers outnumber the pushed and
 * the marble at the far end has somewhere to go, the rim included; going over
 * the rim is how marbles are captured.
 *
 * Everything here is a pure function of a position. Nothing allocates a string,
 * and the only allocations at all are the arrays handed back to the caller.
 */

/** What a move onto a square turns out to be, before it is played. */
export type MovePlan = {
  anchor: CellId
  heading: Heading
  /** The marbles being shoved, from the one the line touches outward. */
  shoved: CellId[]
}

/** A move played out: where everything ended up, and what it cost. */
export type MoveCommit = {
  position: Position
  landings: CellId[]
  /** NOWHERE for each marble driven over the rim. */
  shovedTo: CellId[]
  captured: number
}

/** Most opponents a single line can shove: three pushers, two pushed. */
const MAX_SHOVED = MAX_LINE - 1

/**
 * Every line the side can pick up: all the single marbles first, then every
 * pair and triple, grouped by the marble each one grows out of.
 *
 * A pair appears twice, once read from each end, and so does a triple. That is
 * not redundancy to be optimised away — the two readings are genuinely
 * different moves to make. `commitMove` sends marbles to the back of the roster
 * in the order the line names them, so the two orderings lead to positions that
 * are identical on the board but enumerate differently thereafter, and a bot
 * choosing between two moves it scores equally will settle on one or the other.
 *
 * The order of this list is likewise deliberate. The search keeps the first
 * line that ties for best, so shuffling it changes how bots play.
 *
 * @returns lines, each running end to end
 */
export function linesFor(position: Position, side: Side): CellId[][] {
  const roster = position.roster[side]
  const lines = roster.map((cell) => [cell])

  for (const head of roster) {
    for (let heading = 0; heading < HEADINGS; heading++) {
      const mate = neighbour(head, heading)
      if (mate === NOWHERE || position.occupant[mate] !== side) continue
      lines.push([head, mate])

      const tail = neighbour(mate, heading)
      if (tail === NOWHERE || position.occupant[tail] !== side) continue
      lines.push([head, mate, tail])
    }
  }

  return lines
}

/** Empty neighbours of a lone marble, in heading order. */
function loneSteps(position: Position, cell: CellId): CellId[] {
  const found: CellId[] = []
  for (let heading = 0; heading < HEADINGS; heading++) {
    const to = neighbour(cell, heading)
    if (to !== NOWHERE && position.occupant[to] === VACANT) found.push(to)
  }
  return found
}

/**
 * In-line: the marble at `tip` leads, and may shove whatever it meets.
 * The destination named is always the square the leader steps onto.
 */
function collectInline(
  found: CellId[],
  position: Position,
  line: CellId[],
  tip: CellId,
  heading: Heading,
  side: Side,
): void {
  const target = neighbour(tip, heading)
  if (target === NOWHERE) return

  const standing = position.occupant[target]
  if (standing === VACANT) {
    found.push(target)
    return
  }
  if (standing === side) return // our own back is turned to us

  const foe = rival(side)
  let shoved = 0
  let cursor = target
  while (cursor !== NOWHERE && position.occupant[cursor] === foe) {
    shoved++
    cursor = neighbour(cursor, heading)
  }
  if (shoved >= line.length || shoved > MAX_SHOVED) return

  // `cursor` sits just past the shoved run: off the rim (a capture) or empty.
  if (cursor === NOWHERE || position.occupant[cursor] === VACANT) {
    found.push(target)
  }
}

/**
 * Broadside: the whole line slides one square square-on to its axis, so every
 * marble needs its own empty square. The destination named is the one the
 * marble at `tip` lands on, which is how the board draws the move.
 */
function collectBroadside(
  found: CellId[],
  position: Position,
  line: CellId[],
  tip: CellId,
  facing: Heading,
): void {
  for (const turn of [-1, 1]) {
    const heading = veer(facing, turn)
    const target = neighbour(tip, heading)
    if (target === NOWHERE) continue

    let clear = true
    for (const cell of line) {
      const landing = neighbour(cell, heading)
      if (landing === NOWHERE || position.occupant[landing] !== VACANT) {
        clear = false
        break
      }
    }
    if (clear) found.push(target)
  }
}

/**
 * Every square this line may move onto.
 *
 * `line` must run end to end; `linesFor` produces such lines and `orderLine`
 * puts a hand-picked selection into that shape.
 *
 * @returns destination cells, in-line first and broadside after
 */
export function destinationsFor(
  position: Position,
  line: CellId[],
  side: Side,
): CellId[] {
  if (line.length === 0) return []
  if (line.length === 1) return loneSteps(position, line[0])

  const along = headingBetween(line[0], line[1])
  if (along === NOWHERE) return [] // not a line at all — nothing to offer

  // Read the line the one way round rather than whichever end it arrived from,
  // so the same line always offers its squares in the same order.
  const heading = CANONICAL_HEADING[along]
  const facesLast = along === heading
  const front = facesLast ? line[line.length - 1] : line[0]
  const back = facesLast ? line[0] : line[line.length - 1]
  const backward = reverse(heading)

  const found: CellId[] = []
  collectInline(found, position, line, front, heading, side)
  collectInline(found, position, line, back, backward, side)
  collectBroadside(found, position, line, front, heading)
  collectBroadside(found, position, line, back, backward)
  return found
}

/** Works out what a move onto `target` actually does, without doing it. */
export function resolveMove(
  position: Position,
  line: CellId[],
  target: CellId,
  side: Side,
): MovePlan | null {
  let anchor = NOWHERE
  let heading = NOWHERE
  for (const cell of line) {
    const towards = headingBetween(cell, target)
    if (towards !== NOWHERE) {
      anchor = cell
      heading = towards
      break
    }
  }
  if (anchor === NOWHERE) return null

  const foe = rival(side)
  const shoved: CellId[] = []
  let cursor = target
  while (cursor !== NOWHERE && position.occupant[cursor] === foe) {
    shoved.push(cursor)
    cursor = neighbour(cursor, heading)
  }
  return { anchor, heading, shoved }
}

/**
 * Plays the move out and returns the position it leads to.
 *
 * Marbles that move go to the back of their roster, in the order the line was
 * given and, for the shoved ones, from the far end inward — the order in which
 * the squares ahead of them actually free up.
 */
export function commitMove(
  position: Position,
  line: CellId[],
  heading: Heading,
  shoved: CellId[],
  side: Side,
): MoveCommit | null {
  const landings: CellId[] = new Array(line.length)
  for (let i = 0; i < line.length; i++) {
    landings[i] = neighbour(line[i], heading)
    // a side never walks off its own board
    if (landings[i] === NOWHERE) return null
  }

  const shovedTo: CellId[] = new Array(shoved.length)
  for (let i = 0; i < shoved.length; i++) {
    shovedTo[i] = neighbour(shoved[i], heading)
  }

  const foe = rival(side)
  const occupant = position.occupant.slice()
  let captured = 0

  let foeRoster = position.roster[foe]
  if (shoved.length > 0) {
    foeRoster = foeRoster.filter((cell) => !shoved.includes(cell))
    for (let i = shoved.length - 1; i >= 0; i--) {
      if (shovedTo[i] === NOWHERE) captured++
      else foeRoster.push(shovedTo[i])
    }
  }

  const ownRoster = position.roster[side].filter(
    (cell) => !line.includes(cell),
  )
  for (const cell of landings) ownRoster.push(cell)

  // Empty every square being left before filling any, since a marble may well
  // be stepping onto one another marble is stepping off.
  for (const cell of shoved) occupant[cell] = VACANT
  for (const cell of line) occupant[cell] = VACANT
  for (const cell of shovedTo) if (cell !== NOWHERE) occupant[cell] = foe
  for (const cell of landings) occupant[cell] = side

  const roster: Roster = [null, [], []]
  roster[side] = ownRoster
  roster[foe] = foeRoster

  return { position: { occupant, roster }, landings, shovedTo, captured }
}

/**
 * Puts a hand-picked selection end to end.
 *
 * Cell ids are handed out row by row, so sorting by id walks any of the three
 * axes from one end to the other. That is enough to turn "the marbles the
 * player clicked" into "the line they form" — or, when they form none, into
 * something `isUnbrokenLine` will refuse.
 */
export function orderLine(cells: CellId[]): CellId[] {
  return [...cells].sort((a, b) => a - b)
}

/** Whether the cells, once ordered, really do stand in an unbroken row. */
export function isUnbrokenLine(ordered: CellId[]): boolean {
  if (ordered.length <= 1) return true
  if (ordered.length > MAX_LINE) return false
  const heading = headingBetween(ordered[0], ordered[1])
  if (heading === NOWHERE) return false
  for (let i = 1; i < ordered.length - 1; i++) {
    if (neighbour(ordered[i], heading) !== ordered[i + 1]) return false
  }
  return true
}
