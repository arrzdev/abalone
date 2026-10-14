import type { CellName } from "@repo/abalone-engine/types"

/**
 * The online board's one rule for what it does next. See
 * `docs/online-board.md`.
 *
 * The board shows one ply of the game at a time and only ever gets to another
 * one by this answer. A move played here, the opponent's move arriving, and a
 * resync after the socket was down are the same question asked of different
 * inputs: which ply is the board on, which plies does the server hold, and is
 * there a move of our own the server has not confirmed yet.
 *
 * Not implemented yet: the tests in `board-timeline.test.ts` are the contract.
 */

/** Most plies the board plays out one by one to catch up before it cuts. */
export const MAX_REPLAYED_PLIES = 2

/** One ply as a move: the marbles that were picked up and where they went. */
export type PlyMove = {
  marbles: CellName[]
  destination: CellName
}

/** A move this device played that the server has not confirmed yet. */
export type OptimisticPly = PlyMove & {
  /** The ply index it becomes once the server has it. */
  index: number
  /**
   * The server said this move did not happen. A failed request alone is not
   * that: its answer may have been lost after the move was played.
   */
  refused?: boolean
}

export type BoardTimelineInput = {
  /** The ply the board shows now. */
  shown: number
  /** The last ply index in the server's log, -1 before it has arrived. */
  serverLatest: number
  /** The move that made a ply of the server's log, undefined for the opening. */
  serverMove: (index: number) => PlyMove | undefined
  /** Our own move waiting on the server, or null. */
  optimistic: OptimisticPly | null
  /** False while the tab is hidden or animations are off. */
  canAnimate: boolean
}

export type BoardStep =
  /** The board already shows what there is to show. */
  | { kind: "idle" }
  /** Play this ply out from the one on the board, then show it. */
  | { kind: "play"; index: number; move: PlyMove }
  /** The server has our move as we played it: drop the optimistic ply, change nothing on screen. */
  | { kind: "confirm"; index: number }
  /** Show this ply without playing anything out (the only step that may go back, and only for a refused move). */
  | { kind: "cut"; index: number }

export function nextBoardStep(_input: BoardTimelineInput): BoardStep {
  throw new Error("nextBoardStep is not implemented yet")
}
