import { BOARD_SETUPS } from "@repo/abalone-engine/board-setups"
import type { GameState } from "@repo/abalone-engine/game-state"
import type { ColorChoiceValue } from "@/components/color-choice"
import {
  clearSnapshot,
  readSnapshot,
  writeSnapshot,
} from "@/data/snapshot"

//the offline game in progress, kept so a reload (iOS Safari discarding a
//background tab is the common one) brings the same board back. one game only:
//a new game replaces it, a finished game is never kept, and anything this
//version cannot read is treated as no game at all.

/** Versioned: a save in any other shape is ignored, never migrated. */
export const OFFLINE_GAME_KEY = "abalone.offlineGame.v1"

export type SavedOfflineGame = {
  state: GameState
  difficulty: number
  colorChoice: ColorChoiceValue
}

/** What is stored: the state with its marble sets as arrays. */
type StoredState = Omit<
  GameState,
  "black" | "white" | "selectedMarbles" | "hoveredCell"
> & { black: string[]; white: string[] }

type StoredGame = {
  state: StoredState
  difficulty: number
  colorChoice: ColorChoiceValue
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  )
}

function isPlayer(value: unknown): boolean {
  return value === "black" || value === "white"
}

function isColorChoice(value: unknown): value is ColorChoiceValue {
  return isPlayer(value) || value === "random"
}

/** Whether a stored value is a live game this version can put back on the board. */
function isStoredGame(value: unknown): value is StoredGame {
  if (!value || typeof value !== "object") return false
  const { state, difficulty, colorChoice } = value as Record<
    string,
    unknown
  >
  if (typeof difficulty !== "number" || !isColorChoice(colorChoice)) {
    return false
  }
  if (!state || typeof state !== "object") return false

  const game = state as Record<string, unknown>
  const { moveHistory, currentMoveIndex } = game
  if (!isStringArray(game.black) || !isStringArray(game.white))
    return false
  if (!Array.isArray(moveHistory) || moveHistory.length === 0) return false
  if (
    typeof currentMoveIndex !== "number" ||
    !Number.isInteger(currentMoveIndex) ||
    currentMoveIndex < 0 ||
    currentMoveIndex >= moveHistory.length
  ) {
    return false
  }
  return (
    (game.mode === "ai" || game.mode === "local") &&
    isPlayer(game.playerColor) &&
    isPlayer(game.currentTurn) &&
    typeof game.setupType === "string" &&
    Object.hasOwn(BOARD_SETUPS, game.setupType) &&
    game.gameOver === false
  )
}

/** The saved game, or null for no save, a finished one, or anything unreadable. */
export function readOfflineGame(): SavedOfflineGame | null {
  const stored = readSnapshot<unknown>(OFFLINE_GAME_KEY)
  if (!isStoredGame(stored)) return null

  return {
    difficulty: stored.difficulty,
    colorChoice: stored.colorChoice,
    state: {
      ...stored.state,
      black: new Set(stored.state.black),
      white: new Set(stored.state.white),
      selectedMarbles: [],
      hoveredCell: null,
    },
  }
}

/**
 * Keeps the game as it stands, replacing the last. A finished game is the end
 * of the line: it clears the save instead, so it reopens on the setup screen.
 */
export function writeOfflineGame(game: SavedOfflineGame): void {
  const { state, difficulty, colorChoice } = game
  if (state.gameOver) {
    clearOfflineGame()
    return
  }

  const {
    selectedMarbles: _selectedMarbles,
    hoveredCell: _hoveredCell,
    ...kept
  } = state
  const stored: StoredGame = {
    state: {
      ...kept,
      black: [...state.black],
      white: [...state.white],
    },
    difficulty,
    colorChoice,
  }
  //a full or blocked store only costs the restore, never the game in hand
  try {
    writeSnapshot(OFFLINE_GAME_KEY, stored)
  } catch {
    //raw try/catch: setItem throws on a full or disabled store and the only
    //recovery is to carry on without a save
  }
}

export function clearOfflineGame(): void {
  clearSnapshot(OFFLINE_GAME_KEY)
}
