import { RIM, cellAt, NOWHERE } from '../engine/topology.js';

/**
 * Where the board's squares land on a canvas, and which square a pointer is over.
 *
 * These are the two halves of one mapping — axial coordinates to pixels and
 * back — for a pointy-topped hex grid. `spacing` is the scale everything else
 * follows from; a step to a neighbouring cell is `STEP` times it.
 *
 * Turning the board round for the player sitting opposite is a rotation by half
 * a turn, which in axial coordinates is simply negating both components. It is
 * applied here rather than in the engine, because whose end of the board you
 * are looking from changes nothing about the game.
 */

const ROOT3 = Math.sqrt(3);

/**
 * How far it is to a neighbouring cell, as a multiple of `spacing`.
 *
 * Every heading works out the same length: √3·s along a row, and (√3/2·s, 3/2·s)
 * to the row above, which measures √(3/4 + 9/4)·s — the same √3·s.
 */
export const STEP = ROOT3;

/** Centre of the cell at (r, q), in canvas pixels. */
export function hexCenter(r, q, centerX, centerY, spacing, flipped = false) {
  const row = flipped ? -r : r;
  const col = flipped ? -q : q;
  return {
    x: centerX + spacing * (ROOT3 * col + (ROOT3 / 2) * row),
    y: centerY + spacing * ((3 / 2) * row),
  };
}

/**
 * The cell under a canvas point, or null when the point is off the board.
 * @returns {null|[number, number]} axial (r, q)
 */
export function cellFromPoint(x, y, centerX, centerY, spacing, flipped = false) {
  const dx = x - centerX;
  const dy = y - centerY;

  const col = Math.round(((ROOT3 / 3) * dx - (1 / 3) * dy) / spacing);
  const row = Math.round(((2 / 3) * dy) / spacing);

  if (cellAt(row, col) === NOWHERE) return null;
  return flipped ? [-row, -col] : [row, col];
}

/** Distance from the board's centre to the outside of the rim, in cells. */
export const BOARD_REACH = RIM;
