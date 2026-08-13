import { scorePosition } from "@/ai/evaluate"
import { profileFor } from "@/ai/profiles"
import type { BotMove } from "@/ai/protocol"
import type { MoveCommit } from "@/engine/moves"
import {
  commitMove,
  destinationsFor,
  linesFor,
  resolveMove,
} from "@/engine/moves"
import {
  BLACK,
  createPosition,
  rival,
  sideFromName,
  signature,
} from "@/engine/position"
import { cellNamed, NOWHERE, nameOf } from "@/engine/topology"
import type {
  CellId,
  CellName,
  Position,
  SearchBoard,
  Side,
} from "@/engine/types"

/**
 * Alpha-beta search over Abalone positions.
 *
 * The score is always read from black's point of view, so black maximises and
 * white minimises and one evaluator serves both. Where two moves score the
 * same the earlier one wins, which is why `linesFor` and `destinationsFor`
 * promise a stable order: it is the whole of the bot's personality in
 * positions where nothing is clearly best.
 *
 * A bot is created once per game and remembers the positions the game has
 * actually stood in, so that shuffling back and forth stops looking attractive
 * after the second time. Inside a search that table is extended down the branch
 * being explored and unwound on the way back out, so each line is judged
 * against the repetitions it would really cause.
 */

export type Bot = {
  chooseMove: (board: SearchBoard) => BotMove
  positionsSeen: () => number
}

/** A position standing for the third time is a draw, and worth nothing to anyone. */
const REPETITIONS_ALLOWED = 2

/** Turns the plain board a caller hands us into something the search can walk. */
function readPosition(board: SearchBoard): Position {
  const cells = (names: Iterable<CellName>) => {
    const out: CellId[] = []
    for (const name of names) {
      const cell = cellNamed(name)
      if (cell !== NOWHERE) out.push(cell)
    }
    return out
  }
  return createPosition(cells(board.black), cells(board.white))
}

/** @param level 1..8, see `profiles.ts` */
export function createBot(level: number): Bot {
  const profile = profileFor(level)

  /** Positions the game itself has stood in, by signature. */
  const played = new Map<string, number>()

  /** The same, extended with the branch currently being explored. */
  let visited = played

  /** Plays a move out. The move must have come from `moves`, so it cannot fail. */
  function step(
    position: Position,
    line: CellId[],
    target: CellId,
    side: Side,
  ): MoveCommit {
    const plan = resolveMove(position, line, target, side)
    const after =
      plan && commitMove(position, line, plan.heading, plan.shoved, side)
    if (!after)
      throw new Error("the move generator offered an illegal move")
    return after
  }

  /** What this position is worth to black, standing still. */
  function assess(position: Position, side: Side, stamp: string): number {
    const stood = visited.get(stamp)
    if (stood !== undefined && stood + 1 > REPETITIONS_ALLOWED) return 0
    return scorePosition(position, side, profile)
  }

  function explore(
    position: Position,
    side: Side,
    depth: number,
    alpha: number,
    beta: number,
    stamp: string,
  ): number {
    if (depth === 0) return assess(position, side, stamp)

    const lines = linesFor(position, side)
    if (lines.length === 0) return assess(position, side, stamp)

    const foe = rival(side)
    const maximising = side === BLACK
    let best = maximising
      ? Number.NEGATIVE_INFINITY
      : Number.POSITIVE_INFINITY

    for (const line of lines) {
      for (const target of destinationsFor(position, line, side)) {
        const after = step(position, line, target, side)
        const nextStamp = signature(after.position, foe)

        const before = visited.get(nextStamp)
        visited.set(nextStamp, (before ?? 0) + 1)
        const value = explore(
          after.position,
          foe,
          depth - 1,
          alpha,
          beta,
          nextStamp,
        )
        if (before === undefined) visited.delete(nextStamp)
        else visited.set(nextStamp, before)

        if (maximising) {
          if (value > best) best = value
          if (best > alpha) alpha = best
        } else {
          if (value < best) best = value
          if (best < beta) beta = best
        }
        if (beta <= alpha) return best
      }
    }

    return best
  }

  /** Somewhere legal to go, chosen without thinking about it. */
  function whim(
    position: Position,
    side: Side,
  ): { line: CellId[]; target: CellId } | null {
    const lines = linesFor(position, side)
    if (lines.length === 0) return null

    const line = lines[Math.floor(Math.random() * lines.length)]
    const targets = destinationsFor(position, line, side)
    if (targets.length === 0) return null

    return {
      line,
      target: targets[Math.floor(Math.random() * targets.length)],
    }
  }

  /** Notes that the game has now stood in the position this move leads to. */
  function remember(
    position: Position,
    line: CellId[],
    target: CellId,
    side: Side,
  ): void {
    const after = step(position, line, target, side)
    const stamp = signature(after.position, rival(side))
    played.set(stamp, (played.get(stamp) ?? 0) + 1)
  }

  const report = (
    line: CellId[],
    target: CellId,
    score: number,
  ): BotMove => ({
    type: "move",
    selection: line.map(nameOf),
    move: nameOf(target),
    score,
  })

  function chooseMove(board: SearchBoard): BotMove {
    const position = readPosition(board)
    const side = sideFromName(board.turn)

    // The weaker bots throw a move away now and then. It is the difference
    // between a bot that is bad and a bot that is merely predictable.
    if (profile.caprice > 0 && Math.random() < profile.caprice) {
      const idea = whim(position, side)
      if (idea) {
        remember(position, idea.line, idea.target, side)
        return report(idea.line, idea.target, 0)
      }
    }

    const foe = rival(side)
    const maximising = side === BLACK
    let best = maximising
      ? Number.NEGATIVE_INFINITY
      : Number.POSITIVE_INFINITY
    let bestLine: CellId[] | null = null
    let bestTarget = NOWHERE
    let alpha = Number.NEGATIVE_INFINITY
    let beta = Number.POSITIVE_INFINITY

    // The branch table starts as the game's own history and is unwound back to
    // it as the search returns, so one search never colours the next.
    visited = new Map(played)

    const lines = linesFor(position, side)
    if (lines.length === 0) {
      // Nothing left to move with. Unreachable in a real game — six captures
      // ends it long before — but the caller still gets a straight answer.
      const score = assess(position, side, signature(position, side))
      visited = played
      return { type: "move", selection: null, move: null, score }
    }

    for (const line of lines) {
      for (const target of destinationsFor(position, line, side)) {
        const after = step(position, line, target, side)
        const stamp = signature(after.position, foe)

        const before = visited.get(stamp)
        visited.set(stamp, (before ?? 0) + 1)
        const value = explore(
          after.position,
          foe,
          profile.depth - 1,
          alpha,
          beta,
          stamp,
        )
        if (before === undefined) visited.delete(stamp)
        else visited.set(stamp, before)

        if (maximising ? value > best : value < best) {
          best = value
          bestLine = line
          bestTarget = target
        }
        // No cutoff can fire at the root — one of the two bounds is still
        // infinite — but the bound we do have has to travel down with it.
        if (maximising) alpha = Math.max(alpha, best)
        else beta = Math.min(beta, best)
      }
    }

    visited = played

    if (bestLine === null) {
      // Every line was blocked, or there were none. Take anything legal rather
      // than stall the game; if even that fails, the caller is told plainly.
      const fallback =
        lines.length > 0 ? destinationsFor(position, lines[0], side) : []
      if (fallback.length === 0) {
        return { type: "move", selection: null, move: null, score: best }
      }
      return report(lines[0], fallback[0], 0)
    }

    remember(position, bestLine, bestTarget, side)
    return report(bestLine, bestTarget, best)
  }

  /** How many distinct positions this game has stood in. Diagnostics only. */
  const positionsSeen = () => played.size

  return { chooseMove, positionsSeen }
}
