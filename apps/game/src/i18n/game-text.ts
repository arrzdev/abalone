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
): { title: string; message: string } {
  if (winner === null) {
    return {
      title: t("game:modal.draw"),
      message: t("game:modal.draw_message"),
    }
  }
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
  belgianDaisy: "Belgian Daisy",
  germanDaisy: "German Daisy",
  dutchDaisy: "Dutch Daisy",
  swissDaisy: "Swiss Daisy",
  alien: "Alien",
  domination: "Domination",
  infiltration: "Infiltration",
  theWall: "The Wall",
}

export function getSetupName(setupKey: string): string {
  return SETUP_NAMES[setupKey] || SETUP_NAMES.standard
}
