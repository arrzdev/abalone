import type { Player } from "@repo/abalone-engine/types"

type FinishedGame = {
  playerColor: Player
  winner: Player | null
}

/**
 * How a finished game is counted. Against a bot it is the human's result, since
 * they are the one being counted; pass and play has two humans at one device,
 * so it is the colour that won.
 */
export function finishResultOf(
  game: FinishedGame & { mode: "ai" },
): "win" | "loss" | "draw"
export function finishResultOf(
  game: FinishedGame & { mode: "local" },
): Player | "draw"
export function finishResultOf(
  game: FinishedGame & { mode: "ai" | "local" },
): "win" | "loss" | "draw" | Player {
  if (game.winner === null) return "draw"
  if (game.mode === "local") return game.winner
  return game.winner === game.playerColor ? "win" : "loss"
}
