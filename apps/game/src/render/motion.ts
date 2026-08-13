import type { Point } from "@/engine/types"

/**
 * How the board moves: the few timings the game animates to, and the easing
 * that carries a marble from one square to the next.
 *
 * Animation is a presentation concern, so it lives here rather than beside the
 * rules — the engine has no opinion about how long a move takes to watch.
 */

export const TIMING = {
  /** A marble's journey to the next square, in ms. */
  MOVE: 350,
  /**
   * How long the trail of the previous move takes to go, once a new one has
   * replaced it.
   *
   * Short. All this has to do is take the hard edge off a trail disappearing —
   * long enough not to be a cut, brief enough that the board is settled before
   * you have finished looking at the move that caused it. Run out towards the
   * length of the move itself and the old trail stops reading as something
   * going and starts reading as a second move being played.
   */
  FURROW_FADE: 220,

  /** Beat between the player's move landing and the bot starting to think. */
  BOT_REPLY: 200,
  /** Beat between a move landing and a hot-seat board turning around. */
  BOARD_FLIP: 500,
}

/** Where the board stood when it was last drawn, and where it stands now. */
export type DrawnAt = {
  index: number
  moves: number
}

/**
 * Whether the board got to this position by a move being played, which is the
 * one and only transition the trail of the move before it is allowed to fade
 * out of. Everything else cuts: stepping through the history, undoing, jumping
 * to the latest move, starting a new game.
 *
 * The move list is what tells them apart. Playing appends to it and lands on
 * the entry it just added; walking through it lands on entries that were
 * already there. So the test is that the list grew *and* the board is standing
 * on its new last move — which also covers playing on from a rewound position,
 * where the list is truncated and re-grown in one step.
 *
 * @param before what was last drawn
 * @param after where the board is now
 */
export const arrivedByPlaying = (
  before: { index: number | null; moves: number },
  after: DrawnAt,
) =>
  after.index === (before.index ?? 0) + 1 &&
  after.index === after.moves - 1 &&
  after.moves !== before.moves

/** Whether animation is on before anyone has said otherwise. */
export const ANIMATE_BY_DEFAULT = true

/**
 * Slow to leave, quick through the middle, slow to arrive. Marbles are heavy,
 * and easing them at both ends is what sells that.
 */
export const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2

/** Point `t` of the way from one screen position to another. */
export const interpolate = (from: Point, to: Point, t: number): Point => ({
  x: from.x + (to.x - from.x) * t,
  y: from.y + (to.y - from.y) * t,
})

/**
 * Honoured on the way in only. Someone who has asked their system for less
 * motion gets a still board by default, but the switch in settings still wins:
 * a stated preference beats an inferred one.
 */
export const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches
