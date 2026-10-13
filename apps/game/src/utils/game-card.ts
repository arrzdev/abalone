import type { Game } from "@/data/online/queries"

/**
 * What one card on the hub says about one game, from my seat.
 *
 * Every game on the hub is the same card (board, opponent, turn, times,
 * score), so the readings live here once and the card only lays them out.
 * Contract: `docs/online-hub.md`.
 */
export type GameCard = {
  opponent: { name: string; avatarUrl: string | null }
  /** `over` once the game is finished. */
  turn: "mine" | "theirs" | "over"
  /** `null` while the game is on. */
  result: "won" | "lost" | "draw" | null
  score: {
    mine: number
    theirs: number
    leader: "mine" | "theirs" | "level"
  }
  startedAt: number
  /** `null` before anyone has moved. */
  lastMoveAt: number | null
}

//the contract the hub tests are written against; built in the frontend task
export function gameCardOf(_game: Game, _myUserId: string): GameCard {
  throw new Error("gameCardOf is not built yet")
}
