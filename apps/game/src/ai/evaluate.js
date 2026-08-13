import { MARBLES_PER_SIDE, SURVIVORS_AT_DEFEAT } from '../engine/config.js';
import {
  CELL_COUNT,
  NOWHERE,
  cellRimHeading,
  cellRing,
  cellRow,
  neighbour,
  reverse,
  separation,
} from '../engine/topology.js';
import { BLACK, WHITE } from '../engine/position.js';

/**
 * How good a position is, as a single number from black's point of view:
 * positive favours black, negative favours white, ±100 is a win.
 *
 * Each term below answers one question about the board and is normalised to
 * roughly 0..1 before a profile's weight is applied, so weights from different
 * bots mean the same thing. The terms are then differenced — black's score
 * minus white's — which is what makes the whole evaluation symmetric.
 *
 * Nothing here computes hex geometry. The board never changes shape, so every
 * distance, ring and lane of attack is worked out once into the tables at the
 * top of this file, and evaluating a position is array reads and addition.
 */

/* ------------------------------------------------------------------ *
 * Tables
 * ------------------------------------------------------------------ */

const PAIRS = CELL_COUNT * CELL_COUNT;

/** Value of holding a cell: 4 in the middle, 0 on the rim. */
const CENTRALITY = new Int8Array(CELL_COUNT);

/** How exposed a cell is: 0 unless it is within two rings of the rim. */
const EXPOSURE = new Int8Array(CELL_COUNT);

/** Forwardness of a cell for each side, as an exact eighth. */
const ADVANCE_BLACK = new Float64Array(CELL_COUNT);
const ADVANCE_WHITE = new Float64Array(CELL_COUNT);

/** 1 / distance between two cells — the closeness two marbles lend each other. */
const CLOSENESS = new Float64Array(PAIRS);

/** Whether two cells are near enough to support one another. */
const SUPPORTS = new Uint8Array(PAIRS);

/** What one marble is worth to another as pressure: 3 alongside, 1 nearby, else 0. */
const PRESSURE = new Uint8Array(PAIRS);

/**
 * For each cell, the up-to-three cells directly behind it relative to its
 * nearest rim: the queue a marble would have to form to shove it off.
 */
const SHOVE_LANE = 3;
const LANES = new Int8Array(CELL_COUNT * SHOVE_LANE).fill(NOWHERE);

/**
 * The largest each raw term can reach, used to bring them onto a common scale.
 * They are literal constants rather than derived, because they are what a
 * weight of 1.0 means to every bot: recompute one and every profile shifts.
 */
const MOST_CENTRALITY = 36;
const MOST_CLOSENESS = 55.167;
const MOST_PRESSURE = 42;
const MOST_EXPOSURE = 28;
const LONGEST_REACH = 8;

for (let cell = 0; cell < CELL_COUNT; cell++) {
  const ring = cellRing[cell];
  CENTRALITY[cell] = 4 - ring;
  EXPOSURE[cell] = ring >= 3 ? ring - 2 : 0;
  ADVANCE_BLACK[cell] = (-cellRow[cell] + 4) / 8;
  ADVANCE_WHITE[cell] = (cellRow[cell] + 4) / 8;

  // Walk inward from the cell, away from the rim it is closest to.
  const inward = reverse(cellRimHeading[cell]);
  let behind = cell;
  for (let i = 0; i < SHOVE_LANE; i++) {
    behind = neighbour(behind, inward);
    if (behind === NOWHERE) break;
    LANES[cell * SHOVE_LANE + i] = behind;
  }
}

for (let from = 0; from < CELL_COUNT; from++) {
  for (let to = 0; to < CELL_COUNT; to++) {
    const apart = separation(from, to);
    const slot = from * CELL_COUNT + to;
    CLOSENESS[slot] = apart > 0 ? 1 / apart : 0;
    SUPPORTS[slot] = from !== to && apart <= 1 ? 1 : 0;
    PRESSURE[slot] = cellRing[to] >= 3 && apart <= 2 ? (apart === 1 ? 3 : 1) : 0;
  }
}

/* ------------------------------------------------------------------ *
 * Terms
 * ------------------------------------------------------------------ */

/** How much of the middle a side holds. */
function centrality(marbles) {
  let total = 0;
  for (const cell of marbles) total += CENTRALITY[cell];
  return total / MOST_CENTRALITY;
}

/** How tightly a side's marbles stand together. */
function cohesion(marbles) {
  if (marbles.length <= 1) return 0;
  let total = 0;
  for (let i = 0; i < marbles.length; i++) {
    const row = marbles[i] * CELL_COUNT;
    for (let j = i + 1; j < marbles.length; j++) total += CLOSENESS[row + marbles[j]];
  }
  return total / MOST_CLOSENESS;
}

/** How hard a side is leaning on opponents who are already near the rim. */
function pressure(mine, theirs) {
  let total = 0;
  for (const cell of mine) {
    const row = cell * CELL_COUNT;
    for (const foe of theirs) total += PRESSURE[row + foe];
  }
  return total / MOST_PRESSURE;
}

/** How well a side is queued up behind opponents to shove them off. */
function shovePotential(mine, theirs, occupant, side) {
  if (theirs.length === 0) return 0;

  let total = 0;
  for (const foe of theirs) {
    const lane = foe * SHOVE_LANE;
    let queued = 0;
    for (let i = 0; i < SHOVE_LANE; i++) {
      const cell = LANES[lane + i];
      if (cell === NOWHERE || occupant[cell] !== side) break;
      queued++;
      total += queued; // a longer queue is worth more than the marbles in it
    }
  }
  return total / theirs.length;
}

/** How close a side keeps to the opponent, whether or not that is any use. */
function chase(mine, theirs) {
  if (theirs.length === 0 || mine.length === 0) return 0;

  let total = 0;
  for (const cell of mine) {
    let nearest = Infinity;
    for (const foe of theirs) {
      const apart = separation(cell, foe);
      if (apart < nearest) nearest = apart;
    }
    total += (LONGEST_REACH - nearest) / LONGEST_REACH;
  }
  return total / mine.length;
}

/** How far up the board a side has pushed, measured from its own end. */
function advance(marbles, side) {
  const table = side === BLACK ? ADVANCE_BLACK : ADVANCE_WHITE;
  let total = 0;
  for (const cell of marbles) total += table[cell];
  return total / marbles.length;
}

/** How much of a side is loitering where it can be pushed off. */
function exposure(marbles) {
  let total = 0;
  for (const cell of marbles) total += EXPOSURE[cell];
  return total / MOST_EXPOSURE;
}

/** The share of a side's marbles standing on their own. */
function loners(marbles) {
  let alone = 0;
  for (const cell of marbles) {
    const row = cell * CELL_COUNT;
    let supported = false;
    for (const mate of marbles) {
      if (SUPPORTS[row + mate]) {
        supported = true;
        break;
      }
    }
    if (!supported) alone++;
  }
  return alone / MARBLES_PER_SIDE;
}

/* ------------------------------------------------------------------ *
 * Putting it together
 * ------------------------------------------------------------------ */

/**
 * A bot only goes hunting once it has already won the middle.
 *
 * While it is behind or level in the centre it plays positionally; as its lead
 * grows it trades centre control for attacking pressure, on the reasoning that
 * a position it already owns is worth spending. The appetite runs 0..1 and
 * scales the two attacking weights up while scaling the centre weight down.
 */
function attackAppetite(ourCentre, theirCentre) {
  const lead = Math.max(0, ourCentre - theirCentre);
  if (ourCentre <= 0.4 || lead <= 0.1) return 0;

  const byLead = Math.min(1, lead / 0.3);
  const byHolding = Math.min(1, (ourCentre - 0.4) / 0.4);
  return 0.7 * byHolding + 0.3 * byLead;
}

/**
 * Scores a position from black's point of view.
 *
 * @param {object} position
 * @param {1|2} sideToMove whose turn it is — decides which side's centre lead
 *        the attacking appetite is measured from
 * @param {object} profile from `profiles.js`
 * @returns {number}
 */
export function scorePosition(position, sideToMove, profile) {
  const black = position.roster[BLACK];
  const white = position.roster[WHITE];

  const blackCentre = centrality(black);
  const whiteCentre = centrality(white);
  const forBlack = sideToMove === BLACK;
  const appetite = attackAppetite(
    forBlack ? blackCentre : whiteCentre,
    forBlack ? whiteCentre : blackCentre,
  );

  const centreWeight = profile.centre * (1 - 0.5 * appetite);
  const pressureWeight = profile.edgePressure * appetite;
  const shoveWeight = profile.shovePotential * appetite;

  // A side with six marbles gone has lost; nothing else about the position
  // matters once that is true.
  let total =
    white.length === SURVIVORS_AT_DEFEAT ? 100 : black.length === SURVIVORS_AT_DEFEAT ? -100 : 0;

  total += (black.length - white.length) * profile.capture;

  if (centreWeight !== 0) total += (blackCentre - whiteCentre) * centreWeight;
  if (profile.cohesion !== 0) total += (cohesion(black) - cohesion(white)) * profile.cohesion;
  if (pressureWeight !== 0) {
    total += (pressure(black, white) - pressure(white, black)) * pressureWeight;
  }
  if (shoveWeight !== 0) {
    total +=
      (shovePotential(black, white, position.occupant, BLACK) -
        shovePotential(white, black, position.occupant, WHITE)) *
      shoveWeight;
  }
  if (profile.chase !== 0) total += (chase(black, white) - chase(white, black)) * profile.chase;
  if (profile.charge !== 0) {
    total += (advance(black, BLACK) - advance(white, WHITE)) * profile.charge;
  }
  if (profile.recklessness !== 0) {
    total += (exposure(black) - exposure(white)) * profile.recklessness;
  }
  if (profile.loner !== 0) total += (loners(black) - loners(white)) * profile.loner;

  return total;
}
