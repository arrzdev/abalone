import type { GameState } from "@repo/abalone-engine/game-state"
import { getPossibleMoves } from "@repo/abalone-engine/rules"
import type { CellName, Player } from "@repo/abalone-engine/types"

/** A move a side may play: the marbles picked up, and where they go. */
export type LegalMove = { selection: CellName[]; move: CellName }

/** The first move a side has, so a test plays a move without naming a square. */
export function firstMoveOf(state: GameState, side: Player): LegalMove {
  for (const cell of state[side]) {
    const [move] = getPossibleMoves(state, [cell], side === "black")
    if (move) return { selection: [cell], move }
  }
  throw new Error(`${side} has no move`)
}
