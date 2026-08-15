import { RIM } from "#abalone-engine/topology"

/**
 * The ten opening positions, drawn rather than listed.
 *
 * Each one is a picture of the board: nine rows, the middle row nine squares
 * across, tapering to five at either rim. `b` is a black marble, `w` a white
 * one, `.` an empty square. Rows run r = -4 at the top down to r = +4 at the
 * bottom, and within a row q ascends left to right — the same axes the rest of
 * the engine uses, so a diagram can be checked against the board on screen
 * without translating anything.
 *
 * Reading them costs one pass at module load and buys what a list of
 * coordinates cannot: a marble in the wrong place is visible. The daisies are
 * recognisably flowers, The Wall is a wall, and a typo shows up as a lopsided
 * picture rather than as a number that looks like every other number.
 */

/** An opening, as the two sides' axial coordinates. */
export type BoardSetup = {
  black: [number, number][]
  white: [number, number][]
}

const BLACK = "b"
const WHITE = "w"

const ROWS = 2 * RIM + 1

/** The lowest q on row `r`; the row then runs for `rowWidth(r)` squares. */
const rowStart = (r: number) => Math.max(-RIM, -RIM - r)
const rowWidth = (r: number) => ROWS - Math.abs(r)

/**
 * Turns a drawing into the two sides' squares, row by row and left to right.
 *
 * The checks are here because a diagram is edited by hand: a dropped square
 * silently shifts every marble after it along its row, which is exactly the
 * kind of mistake that would otherwise reach the board looking plausible.
 */
function read(art: string): BoardSetup {
  const lines = art.trim().split("\n")
  if (lines.length !== ROWS) {
    throw new Error(`a board is ${ROWS} rows, not ${lines.length}`)
  }

  const black: [number, number][] = []
  const white: [number, number][] = []

  lines.forEach((line, i) => {
    const r = i - RIM
    const glyphs = line.trim().split(/\s+/)
    if (glyphs.length !== rowWidth(r)) {
      throw new Error(
        `row ${r} holds ${rowWidth(r)} squares, not ${glyphs.length}`,
      )
    }
    glyphs.forEach((glyph, step) => {
      if (glyph === BLACK) black.push([r, rowStart(r) + step])
      else if (glyph === WHITE) white.push([r, rowStart(r) + step])
    })
  })

  if (black.length !== white.length) {
    throw new Error(
      `lopsided opening: ${black.length} black against ${white.length} white`,
    )
  }
  return { black, white }
}

export const BOARD_SETUPS = {
  standard: read(`
    w w w w w
   w w w w w w
  . . w w w . .
 . . . . . . . .
. . . . . . . . .
 . . . . . . . .
  . . b b b . .
   b b b b b b
    b b b b b
  `),

  belgian_daisy: read(`
    w w . b b
   w w w b b b
  . w w . b b .
 . . . . . . . .
. . . . . . . . .
 . . . . . . . .
  . b b . w w .
   b b b w w w
    b b . w w
  `),

  german_daisy: read(`
    . . . . .
   w w . . b b
  w w w . b b b
 . w w . . b b .
. . . . . . . . .
 . b b . . w w .
  b b b . w w w
   b b . . w w
    . . . . .
  `),

  dutch_daisy: read(`
    w w . b b
   w b w b w b
  . w w . b b .
 . . . . . . . .
. . . . . . . . .
 . . . . . . . .
  . b b . w w .
   b w b w b w
    b b . w w
  `),

  swiss_daisy: read(`
    . . . . .
   w w . . b b
  w b w . b w b
 . w w . . b b .
. . . . . . . . .
 . b b . . w w .
  b w b . w b w
   b b . . w w
    . . . . .
  `),

  alien: read(`
    b . b . b
   . b w w b .
  . b w b w b .
 . . . b b . . .
. . . . . . . . .
 . . . w w . . .
  . w b w b w .
   . w b b w .
    w . w . w
  `),

  domination: read(`
    . . . . .
   w . . . . b
  w w . . . b b
 w w w w . b b b
. . . b . b . . .
 b b b . w w w w
  b b . . . w w
   b . . . . w
    . . . . .
  `),

  infiltration: read(`
    . b w b .
   . b b b b .
  . b w b w b .
 . b . . . . b .
. . . . . . . . .
 . w . . . . w .
  . w b w b w .
   . w w w w .
    . w b w .
  `),

  the_wall: read(`
    . . w . .
   . . . . . .
  . w w w w w .
 w w w w w w w w
. . . . . . . . .
 b b b b b b b b
  . b b b b b .
   . . . . . .
    . . b . .
  `),

  custom: read(`
    . . . . .
   . . . . b .
  w . . . b . .
 . b . . w . . .
. . b . w . . . .
 . . . w . . . .
  . . . . . . .
   . . . . . .
    . . . . .
  `),
}

/** The key of an opening, which is what a preference stores. */
export type SetupKey = keyof typeof BOARD_SETUPS

export const DEFAULT_SETUP: SetupKey = "standard"
