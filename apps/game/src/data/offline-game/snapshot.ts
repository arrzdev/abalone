import type { GameState } from "@repo/abalone-engine/game-state"
import type { ColorChoiceValue } from "@/components/color-choice"

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

export function readOfflineGame(): SavedOfflineGame | null {
  //TODO(TUD-4482): not implemented yet, the tests beside this file say what it does
  return null
}

export function writeOfflineGame(_game: SavedOfflineGame): void {
  //TODO(TUD-4482): not implemented yet
}

export function clearOfflineGame(): void {
  //TODO(TUD-4482): not implemented yet
}
