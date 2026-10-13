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

/** Won, lost or drawn, from `seat`. */
function resultOf(game: Game, seat: "black" | "white") {
  if (!game.winner) return "draw"
  return game.winner === seat ? "won" : "lost"
}

/** Who is ahead, from my side of the score. */
function leaderOf(mine: number, theirs: number) {
  if (mine > theirs) return "mine"
  if (theirs > mine) return "theirs"
  return "level"
}

export function gameCardOf(game: Game, myUserId: string): GameCard {
  const seat = game.black.userId === myUserId ? "black" : "white"
  const opponent = seat === "black" ? game.white : game.black
  const mine = seat === "black" ? game.blackScore : game.whiteScore
  const theirs = seat === "black" ? game.whiteScore : game.blackScore
  const isOver = game.status === "finished"

  let turn: GameCard["turn"] = "theirs"
  if (isOver) turn = "over"
  else if (game.currentTurn === seat) turn = "mine"

  return {
    opponent: { name: opponent.name, avatarUrl: opponent.avatarUrl },
    turn,
    result: isOver ? resultOf(game, seat) : null,
    score: { mine, theirs, leader: leaderOf(mine, theirs) },
    startedAt: game.createdAt,
    //a game nobody has moved in was last touched when it was made, which is
    //not a move
    lastMoveAt: game.moveCount > 0 ? game.updatedAt : null,
  }
}
