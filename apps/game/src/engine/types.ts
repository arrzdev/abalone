/**
 * The vocabulary the game is written in.
 *
 * Two ways of naming the same things run through it, and the split is
 * deliberate. Below `rules.ts` a square is a `CellId` and a colour is a
 * `Side` — plain integers a typed array can hold and an inner loop can
 * index with. Above it a square is a `CellName` and a colour is a
 * `Player`, both strings React can put in a key and a move list can
 * print. `rules.ts` is the only place the two meet.
 */

/** A square's dense id, in [0, CELL_COUNT), or `NOWHERE`. */
export type CellId = number

/** One of the six ways to travel, in [0, HEADINGS), or `NOWHERE`. */
export type Heading = number

/** A square's public name: its axial coordinates, as `"r,q"`. */
export type CellName = string

/** An axial (Δr, Δq) step — a direction, as everything above wants it. */
export type AxialStep = [number, number]

/** A colour, as the engine holds it: `BLACK` or `WHITE`. */
export type Side = 1 | 2

/** A colour, as everything above the engine names it. */
export type Player = "black" | "white"

/**
 * Each side's marbles, indexed by `Side`, so `roster[occupant[cell]]` is
 * always the right list. Slot 0 is `VACANT` and holds nobody.
 */
export type Roster = [null, CellId[], CellId[]]

export type Position = {
  occupant: Uint8Array
  roster: Roster
}

/** Who stands where, by name — the shape a `GameState` already has. */
export type Board = {
  black: Set<CellName>
  white: Set<CellName>
}

/** The bare board a bot is handed — see `toSearchState`. */
export type SearchBoard = {
  black: CellName[]
  white: CellName[]
  turn: Player
}

/** A point on the canvas. */
export type Point = {
  x: number
  y: number
}
