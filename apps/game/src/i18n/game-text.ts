import type { GameState } from "@repo/abalone-engine/game-state"
import type { Player } from "@repo/abalone-engine/types"
import type { TFunction } from "i18next"
import { getBot } from "@/i18n/bots"

/**
 * Game-state copy: the strings that are chosen rather than looked up.
 *
 * Who the bots are lives in `bots.ts`, next to what they say — a name and a
 * voice belong to the same character, and keeping them apart is how a roster
 * ends up half-renamed. This only reaches through for the name.
 */

export { BOT_LEVELS } from "@/i18n/bots"

/**
 * How a finished game ended, in the words the game over sheet uses: who won and
 * how, for the status line under the board.
 *
 * `youColor` is the side this device is playing, or null where nobody is "you"
 * (hot seat), so the names stand in for it. `nameOf` is what each side is
 * called. Empty while the game is still on.
 */
export function describeGameResult(
  t: TFunction,
  state: GameState,
  youColor: Player | null,
  nameOf: (color: Player) => string,
): string {
  const { gameOver, gameOverReason, winner } = state
  if (!gameOver) return ""
  if (winner === null) {
    return gameOverReason === "threefold_repetition"
      ? t("game:result.draw_repetition")
      : t("game:result.draw")
  }

  const loser: Player = winner === "black" ? "white" : "black"
  if (gameOverReason === "resignation") {
    if (loser === youColor) {
      return t("game:result.resigned_you", { winner: nameOf(winner) })
    }
    if (winner === youColor) {
      return t("game:result.resigned_opponent", { loser: nameOf(loser) })
    }
    return t("game:result.resigned_other", {
      loser: nameOf(loser),
      winner: nameOf(winner),
    })
  }

  const scores = {
    winnerScore: winner === "black" ? state.blackScore : state.whiteScore,
    loserScore: winner === "black" ? state.whiteScore : state.blackScore,
  }
  if (winner === youColor) return t("game:result.win_you", scores)
  return t("game:result.win_other", { name: nameOf(winner), ...scores })
}

export function getBotName(level: number): string {
  return getBot(level).name
}

export function getDifficultyName(level: number): string {
  return getBotName(level)
}

export function getOpponentName(level: number): string {
  return getDifficultyName(level)
}

/** Who a result is addressed to; null means a draw. */
export type ResultSubject = "player" | "ai"

export function getGameOverMessage(
  t: TFunction,
  winner: ResultSubject | null,
  difficulty: number,
): { title: string; message?: string } {
  //"Draw!" says all of it
  if (winner === null) return { title: t("game:modal.draw") }
  const difficultyName = getDifficultyName(difficulty)
  if (winner === "player") {
    return {
      title: t("game:modal.you_win"),
      message: t("game:modal.victory_message", {
        difficulty: difficultyName,
      }),
    }
  }
  return {
    title: t("game:modal.opponent_won", {
      opponent: getOpponentName(difficulty),
    }),
    message: t("game:modal.defeat_message", {
      difficulty: difficultyName,
    }),
  }
}

export const SETUP_NAMES: Record<string, string> = {
  standard: "Standard",
  belgian_daisy: "Belgian Daisy",
  german_daisy: "German Daisy",
  dutch_daisy: "Dutch Daisy",
  swiss_daisy: "Swiss Daisy",
  alien: "Alien",
  domination: "Domination",
  infiltration: "Infiltration",
  the_wall: "The Wall",
}

export function getSetupName(setupKey: string): string {
  return SETUP_NAMES[setupKey] || SETUP_NAMES.standard
}
