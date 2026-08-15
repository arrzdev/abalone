import type {
  AxialStep,
  CellId,
  CellName,
  Heading,
} from "#abalone-engine/types"

/**
 * The board's fixed geometry, resolved once into lookup tables.
 *
 * Abalone is played on a hexagon of 61 cells that never changes shape, so every
 * question about it — who neighbours whom, how far apart two cells lie, which
 * way the nearest rim is — has an answer that can be worked out at module load
 * and then simply read back. That is what this file is: no arithmetic in the
 * hot path, only array indexing.
 *
 * Cells are addressed by `id`, a dense integer in [0, CELL_COUNT). `NOWHERE` is
 * returned for anything off the board; walking off the rim is an ordinary
 * outcome of a push, not an error, so it gets a value rather than an exception.
 *
 * Cell *names* — the `"r,q"` axial strings — are the currency of the React
 * layer, the move history and the renderer. They are translated at the edges
 * (see `rules.ts`); nothing inside the engine handles a string.
 */

/** Rings from the centre cell out to the rim. */
export const RIM = 4
export const CELL_COUNT = 61
export const HEADINGS = 6
export const NOWHERE = -1

/**
 * The six ways a marble can travel, in ring order, as axial (Δr, Δq) steps.
 *
 * The order is load-bearing, not cosmetic: `reverse` and `veer` do modular
 * arithmetic on heading indices, and a broadside move is defined as the
 * headings immediately either side of the line's own.
 */
export const HEADING_STEPS: readonly AxialStep[] = Object.freeze([
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, 0],
  [-1, 1],
  [0, 1],
])

/** The heading pointing back the way you came. */
export const reverse = (heading: Heading): Heading =>
  (heading + 3) % HEADINGS

/** The heading `turns` sixths-of-a-turn round from this one; `turns` may be negative. */
export const veer = (heading: Heading, turns: number): Heading =>
  (heading + turns + HEADINGS) % HEADINGS

/**
 * A line has two ends and so two headings that describe it. This picks one of
 * them — the one that runs *down* the board — so that a line reads the same
 * whichever end it was discovered from, and the moves it offers always come out
 * in the same order.
 */
export const CANONICAL_HEADING = new Int8Array(HEADINGS)

const SPAN = RIM * 2 + 1
const OFF_GRID = new Int8Array(SPAN * SPAN).fill(NOWHERE)

/** Axial row and column of each cell. */
export const cellRow = new Int8Array(CELL_COUNT)
export const cellCol = new Int8Array(CELL_COUNT)

/** `"r,q"` for each cell, and the reverse mapping. */
export const cellNames: CellName[] = new Array(CELL_COUNT)
const idsByName = new Map<CellName, CellId>()

const ADJACENCY = new Int8Array(CELL_COUNT * HEADINGS)
const HEADING_BETWEEN = new Int8Array(CELL_COUNT * CELL_COUNT).fill(
  NOWHERE,
)
const SEPARATION = new Int8Array(CELL_COUNT * CELL_COUNT)

/** How far each cell sits from the centre: 0 in the middle, RIM on the rim. */
export const cellRing = new Int8Array(CELL_COUNT)

/** For each cell, the heading that runs out of board soonest (lowest index wins ties). */
export const cellRimHeading = new Int8Array(CELL_COUNT)

/**
 * How many steps apart two squares are.
 *
 * Axial (r, q) is the cube coordinate (q, -(r + q), r), and a step along any
 * heading moves exactly two of those three axes. The distance is therefore the
 * largest of the three axis displacements.
 */
function axialDistance(
  r1: number,
  q1: number,
  r2: number,
  q2: number,
): number {
  return Math.max(
    Math.abs(r1 - r2),
    Math.abs(q1 - q2),
    Math.abs(r1 + q1 - r2 - q2),
  )
}

/** The board is every square within RIM steps of the centre. That is all it is. */
function inBounds(r: number, q: number): boolean {
  return axialDistance(r, q, 0, 0) <= RIM
}

/* ---- table construction, once ---- */

for (let heading = 0; heading < HEADINGS; heading++) {
  const [dr] = HEADING_STEPS[heading]
  CANONICAL_HEADING[heading] = dr < 0 ? reverse(heading) : heading
}

{
  let id = 0
  for (let r = -RIM; r <= RIM; r++) {
    for (let q = -RIM; q <= RIM; q++) {
      if (!inBounds(r, q)) continue
      OFF_GRID[(r + RIM) * SPAN + (q + RIM)] = id
      cellRow[id] = r
      cellCol[id] = q
      cellNames[id] = `${r},${q}`
      idsByName.set(cellNames[id], id)
      cellRing[id] = axialDistance(r, q, 0, 0)
      id++
    }
  }
}

/** The cell at these axial coordinates, or NOWHERE. */
export function cellAt(r: number, q: number): CellId {
  if (r < -RIM || r > RIM || q < -RIM || q > RIM) return NOWHERE
  return OFF_GRID[(r + RIM) * SPAN + (q + RIM)]
}

for (let id = 0; id < CELL_COUNT; id++) {
  for (let heading = 0; heading < HEADINGS; heading++) {
    const [dr, dq] = HEADING_STEPS[heading]
    ADJACENCY[id * HEADINGS + heading] = cellAt(
      cellRow[id] + dr,
      cellCol[id] + dq,
    )
  }
}

for (let from = 0; from < CELL_COUNT; from++) {
  for (let to = 0; to < CELL_COUNT; to++) {
    SEPARATION[from * CELL_COUNT + to] = axialDistance(
      cellRow[from],
      cellCol[from],
      cellRow[to],
      cellCol[to],
    )
  }
  for (let heading = 0; heading < HEADINGS; heading++) {
    const to = ADJACENCY[from * HEADINGS + heading]
    if (to !== NOWHERE) HEADING_BETWEEN[from * CELL_COUNT + to] = heading
  }
}

for (let id = 0; id < CELL_COUNT; id++) {
  let shortest = Number.POSITIVE_INFINITY
  let best = 0
  for (let heading = 0; heading < HEADINGS; heading++) {
    let steps = 0
    let cell = id
    while (cell !== NOWHERE) {
      cell = ADJACENCY[cell * HEADINGS + heading]
      steps++
    }
    if (steps < shortest) {
      shortest = steps
      best = heading
    }
  }
  cellRimHeading[id] = best
}

/* ---- accessors ---- */

/** One step from `cell` along `heading`, or NOWHERE if that leaves the board. */
export const neighbour = (cell: CellId, heading: Heading): CellId =>
  ADJACENCY[cell * HEADINGS + heading]

/** The heading that takes you from `from` to `to` in a single step, else NOWHERE. */
export const headingBetween = (from: CellId, to: CellId): Heading =>
  HEADING_BETWEEN[from * CELL_COUNT + to]

/** Hex distance between two cells. */
export const separation = (from: CellId, to: CellId): number =>
  SEPARATION[from * CELL_COUNT + to]

/** `"r,q"` for a cell id. */
export const nameOf = (cell: CellId): CellName => cellNames[cell]

/**
 * Names the square one step on from `cell`, whether or not it exists.
 *
 * A captured marble is animated to the square it was heading for, which is by
 * definition past the rim and so has no id — but it does have coordinates, and
 * the renderer draws from those.
 */
export function nameBeyond(cell: CellId, heading: Heading): CellName {
  const [dr, dq] = HEADING_STEPS[heading]
  return `${cellRow[cell] + dr},${cellCol[cell] + dq}`
}

/** Cell id for a `"r,q"` name, or NOWHERE if it names nothing on the board. */
export const cellNamed = (name: CellName): CellId => {
  const id = idsByName.get(name)
  return id === undefined ? NOWHERE : id
}

/** Every cell, in table order. Handy for renderers and for building own tables. */
export const ALL_CELLS: readonly CellId[] = Object.freeze([
  ...Array(CELL_COUNT).keys(),
])
