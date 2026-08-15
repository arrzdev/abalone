import { WINNING_SCORE } from "@repo/abalone-engine/config"
import type { GameState } from "@repo/abalone-engine/game-state"
import {
  positionFromNames,
  sideFromName,
} from "@repo/abalone-engine/position"
import type { ScoringWeights } from "@/ai/evaluate"
import { scorePosition } from "@/ai/evaluate"

/**
 * What the evaluation bar reads, from black's point of view: positive favours
 * black, and the magnitude is roughly "marbles ahead", because a captured
 * marble is worth exactly 1 and everything positional is smaller than that.
 *
 * This asks the evaluator about the position on the board right now. It used to
 * display whatever score the bot's own search happened to report, which was
 * wrong three ways over: the number only arrived when the *bot* moved, so your
 * own captures did not register until it replied and the winning capture never
 * did at all — the game ends, the bot never answers, and the bar stays frozen
 * on whatever it last said. Worse, a bot playing one of its deliberate random
 * moves reports a score of 0, so at level 1 roughly one move in seven pinned
 * the bar to dead even no matter who was winning.
 *
 * The weights below are deliberately not a bot's. A bot profile is tuned to
 * make a *player*, and the weak ones are supposed to want the wrong things —
 * level 1 chases marbles it cannot catch and parks on the rim. Reading the
 * board through those eyes would tell you what Gus thinks of the position, not
 * who is winning. These are the strongest profile's priorities, frozen here so
 * that retuning a bot never moves the bar under you.
 */
const BAR_WEIGHTS: ScoringWeights = Object.freeze({
  capture: 1,
  centre: 2,
  cohesion: 0.3,
  edgePressure: 0.5,
  shovePotential: 0.5,
  chase: 0,
  charge: 0,
  recklessness: 0,
  loner: 0,
})

/** Past this, the position is not an advantage but a result. */
export const DECIDED = WINNING_SCORE

/**
 * How many marbles of advantage it takes to fill half the remaining bar. Low
 * enough that the sub-marble margins of the opening are visible, high enough
 * that a real lead still has somewhere to grow.
 */
const SOFTNESS = 3

/**
 * Scores the position a game state is standing in.
 *
 * A finished game reports the result rather than the arithmetic: someone who
 * resigned may still have been ahead on the board, and the bar should not argue
 * with the scoreboard.
 *
 * @returns black's advantage, in marbles
 */
export function evaluateBoard(state: GameState | null): number {
  if (!state) return 0
  if (state.gameOver && state.winner) {
    return state.winner === "black" ? DECIDED : -DECIDED
  }

  return scorePosition(
    positionFromNames(state.black, state.white),
    sideFromName(state.currentTurn),
    BAR_WEIGHTS,
  )
}

/**
 * The score as a share of the bar, 0..1 from white's end to black's.
 *
 * Saturating rather than linear. Clipping at ±6 sounds right — six marbles is
 * the game — but it makes the whole opening unreadable: every positional term
 * put together moves the score about half a marble, which on a straight ±6
 * scale is four percent of the bar, so it sits at dead centre until somebody
 * captures. `tanh` spends the middle of the bar on the small margins that are
 * all there is to see for the first twenty moves, and still leaves room above
 * for a three-marble lead to look like one.
 *
 * Divided through by `tanh(DECIDED/SOFTNESS)` so the ends are exact: a decided
 * game fills the bar rather than stopping two percent short of it.
 */
export function barFraction(score: number): number {
  const capped = Math.max(-DECIDED, Math.min(DECIDED, score))
  return (
    0.5 +
    0.5 * (Math.tanh(capped / SOFTNESS) / Math.tanh(DECIDED / SOFTNESS))
  )
}
