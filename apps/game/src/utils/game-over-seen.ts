import tryCatch from "@repo/shared/try-catch"

/**
 * The online games whose result sheet this device has already shown, newest
 * last. Per device rather than synced: a sheet shown once on each device is
 * fine, and syncing it would need a route of its own.
 */
export const GAME_OVER_SEEN_KEY = "abalone_game_over_seen"

/** Enough for anyone's recent games; the oldest fall off the front. */
export const GAME_OVER_SEEN_LIMIT = 200

//the list as this page load knows it. storage that refuses every call (private
//mode) still gets a sheet that shows once per page load rather than every open
const rememberedSeen = new Set<string>()

function readSeen(): string[] {
  const [raw] = tryCatch(() => localStorage.getItem(GAME_OVER_SEEN_KEY))
  if (!raw) return []
  const [parsed] = tryCatch(() => JSON.parse(raw) as unknown)
  if (!Array.isArray(parsed)) return []
  return parsed.filter((id): id is string => typeof id === "string")
}

/** Whether this device has shown the result sheet for `gameId`. */
export function hasSeenGameOver(gameId: string): boolean {
  return rememberedSeen.has(gameId) || readSeen().includes(gameId)
}

/** Remembers that the result sheet for `gameId` has been shown. */
export function markGameOverSeen(gameId: string): void {
  rememberedSeen.add(gameId)
  const seen = readSeen().filter((id) => id !== gameId)
  seen.push(gameId)
  const kept = seen.slice(-GAME_OVER_SEEN_LIMIT)
  tryCatch(() =>
    localStorage.setItem(GAME_OVER_SEEN_KEY, JSON.stringify(kept)),
  )
}

/** Forgets every game, this page load's included. For tests. */
export function resetGameOverSeen(): void {
  rememberedSeen.clear()
  tryCatch(() => localStorage.removeItem(GAME_OVER_SEEN_KEY))
}
