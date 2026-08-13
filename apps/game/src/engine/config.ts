/**
 * The numbers the rules of Abalone are written in.
 *
 * Geometry lives in `topology.ts` and timings in `render/motion.ts`; what
 * is left here is the handful of constants that decide when a game is won
 * and how many marbles may travel together.
 */

/** Marbles each side starts with, on every board setup. */
export const MARBLES_PER_SIDE = 14

/** Marbles you must push off the board to win. */
export const WINNING_SCORE = 6

/** Marbles that can move as one line. */
export const MAX_LINE = 3

/** How many of your own you must still have on the board to be in the game. */
export const SURVIVORS_AT_DEFEAT = MARBLES_PER_SIDE - WINNING_SCORE
