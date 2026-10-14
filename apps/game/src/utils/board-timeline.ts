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

/** The same marbles to the same square, in whatever order they were listed. */
function isSameMove(a: PlyMove, b: PlyMove): boolean {
  if (a.destination !== b.destination) return false
  if (a.marbles.length !== b.marbles.length) return false
  return a.marbles.every((cell) => b.marbles.includes(cell))
}

export function nextBoardStep(input: BoardTimelineInput): BoardStep {
  const { shown, serverLatest, serverMove, optimistic, canAnimate } = input

  if (optimistic) {
    //the one way back: the server said our move did not happen
    if (optimistic.refused) return { kind: "cut", index: serverLatest }

    //our own move is played out like any other ply, before anything the
    //server has to say about it
    if (shown < optimistic.index) {
      return { kind: "play", index: optimistic.index, move: optimistic }
    }

    if (serverLatest < optimistic.index) return { kind: "idle" }

    const logged = serverMove(optimistic.index)
    if (logged && isSameMove(logged, optimistic)) {
      return { kind: "confirm", index: optimistic.index }
    }
    return { kind: "cut", index: serverLatest }
  }

  //a log older than the board is ignored, never shown
  if (serverLatest <= shown) return { kind: "idle" }

  const next = shown + 1
  const move = serverMove(next)
  const tooFar = shown < 0 || serverLatest - shown > MAX_REPLAYED_PLIES
  if (!canAnimate || tooFar || !move) {
    return { kind: "cut", index: serverLatest }
  }
  return { kind: "play", index: next, move }
}

/**
 * What a failed play request said about the move.
 *
 * `refused`: the server answered with a domain error (a 4xx envelope), so the
 * move was never played. `unknown`: a network error or a 5xx, so the answer may
 * have been lost after the server played it.
 */
export type MoveFailure = "refused" | "unknown"

export type FailedMoveInput = {
  failure: MoveFailure
  /** The ply index the move becomes once the server has it. */
  index: number
  /** The last ply index in the server's log as last fetched. */
  serverLatest: number
  /** How many times the log has been fetched again since the request failed. */
  refetches: number
}

/** Mark the move refused, fetch the log again, or leave it to `nextBoardStep`. */
export type FailedMoveVerdict = "refused" | "refetch" | "settled"

/** Most times the log is fetched again before a lost answer counts as a refusal. */
export const MAX_FAILED_MOVE_REFETCHES = 2

/**
 * What a failed play request means for the optimistic ply it carried.
 *
 * Only the server can say a move did not happen: in so many words (a domain
 * error), or by logging a different move at that index, which `nextBoardStep`
 * already answers with a `cut`. Anything else may be an answer lost after the
 * move was played, so the log is asked again, twice, before the silence
 * counts as a refusal.
 */
export function failedMoveVerdict(
  input: FailedMoveInput,
): FailedMoveVerdict {
  if (input.failure === "refused") return "refused"
  if (input.serverLatest >= input.index) return "settled"
  if (input.refetches < MAX_FAILED_MOVE_REFETCHES) return "refetch"
  return "refused"
}
