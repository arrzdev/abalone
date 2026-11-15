import type { GameState } from "@repo/abalone-engine/game-state"
import {
  createGameState,
  resignGame,
} from "@repo/abalone-engine/game-state"
import type { Player } from "@repo/abalone-engine/types"
import type { TFunction } from "i18next"
import { describe, expect, it } from "vitest"
import {
  describeGameResult,
  getBotName,
  getDifficultyName,
  getGameOverMessage,
  getOpponentName,
  getSetupName,
  SETUP_NAMES,
} from "@/i18n/game-text"

//a translator that shows which key was asked for and with what, so the branch
//taken is readable without loading any locale
const t = ((key: string, options?: Record<string, unknown>) =>
  options
    ? `${key} ${JSON.stringify(options)}`
    : key) as unknown as TFunction

function nameOf(color: Player): string {
  return color === "black" ? "Ada" : "Bo"
}

function finished(patch: Partial<GameState>): GameState {
  return {
    ...createGameState("standard", "black", "local"),
    gameOver: true,
    ...patch,
  }
}

describe("describeGameResult", () => {
  it("is empty while the game is on", () => {
    const state = createGameState("standard", "black", "local")
    expect(describeGameResult(t, state, "black", nameOf)).toBe("")
  })

  it("says draw, and a draw by repetition apart", () => {
    const draw = finished({ winner: null, gameOverReason: null })
    expect(describeGameResult(t, draw, null, nameOf)).toBe(
      "game:result.draw",
    )

    const repeated = finished({
      winner: null,
      gameOverReason: "threefold_repetition",
    })
    expect(describeGameResult(t, repeated, null, nameOf)).toBe(
      "game:result.draw_repetition",
    )
  })

  it("tells the loser they resigned, naming who won", () => {
    const state = finished({
      winner: "white",
      gameOverReason: "resignation",
    })
    expect(describeGameResult(t, state, "black", nameOf)).toBe(
      `game:result.resigned_you {"winner":"Bo"}`,
    )
  })

  it("tells the winner their opponent resigned", () => {
    const state = finished({
      winner: "white",
      gameOverReason: "resignation",
    })
    expect(describeGameResult(t, state, "white", nameOf)).toBe(
      `game:result.resigned_opponent {"loser":"Ada"}`,
    )
  })

  it("names both sides on a resignation nobody is party to", () => {
    const state = finished({
      winner: "white",
      gameOverReason: "resignation",
    })
    expect(describeGameResult(t, state, null, nameOf)).toBe(
      `game:result.resigned_other {"loser":"Ada","winner":"Bo"}`,
    )
  })

  it("reports the score from the winner's side", () => {
    const state = finished({
      winner: "white",
      gameOverReason: "score",
      blackScore: 2,
      whiteScore: 6,
    })
    expect(describeGameResult(t, state, "white", nameOf)).toBe(
      `game:result.win_you {"winnerScore":6,"loserScore":2}`,
    )
    expect(describeGameResult(t, state, "black", nameOf)).toBe(
      `game:result.win_other {"name":"Bo","winnerScore":6,"loserScore":2}`,
    )
  })

  it("works with a real resignation out of the engine", () => {
    const resigned = resignGame(
      createGameState("standard", "black", "local"),
      "black",
    )
    expect(describeGameResult(t, resigned, "white", nameOf)).toContain(
      "game:result.resigned_opponent",
    )
  })
})

describe("bot names", () => {
  it("are the same word whichever way the bot is asked for", () => {
    expect(getBotName(2)).toBe("Milo")
    expect(getDifficultyName(2)).toBe("Milo")
    expect(getOpponentName(2)).toBe("Milo")
  })

  it("fall back to the first bot for an unknown level", () => {
    expect(getBotName(0)).toBe("Gus")
  })
})

describe("getGameOverMessage", () => {
  it("is a title and nothing more for a draw", () => {
    expect(getGameOverMessage(t, null, 3)).toEqual({
      title: "game:modal.draw",
    })
  })

  it("congratulates the player, naming the bot beaten", () => {
    expect(getGameOverMessage(t, "player", 3)).toEqual({
      title: "game:modal.you_win",
      message: `game:modal.victory_message {"difficulty":"Nora"}`,
    })
  })

  it("names the bot that won", () => {
    expect(getGameOverMessage(t, "ai", 3)).toEqual({
      title: `game:modal.opponent_won {"opponent":"Nora"}`,
      message: `game:modal.defeat_message {"difficulty":"Nora"}`,
    })
  })
})

describe("getSetupName", () => {
  it("names every setup", () => {
    expect(getSetupName("belgian_daisy")).toBe("Belgian Daisy")
    expect(getSetupName("the_wall")).toBe("The Wall")
  })

  it("falls back to Standard for a key it does not know", () => {
    expect(getSetupName("nonsense")).toBe(SETUP_NAMES.standard)
    expect(getSetupName("")).toBe("Standard")
  })
})
