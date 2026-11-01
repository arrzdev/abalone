import type { Game } from "@/data/online/queries"

/** The most people the composer offers by face. The rest are reached by typing. */
export const RECENT_OPPONENT_LIMIT = 4

/** Somebody I have played, as the invite composer offers them. */
export type RecentOpponent = {
  name: string
  avatarUrl: string | null
  /** The `updatedAt` of the latest game between us. */
  lastPlayedAt: number
}

/**
 * Who I played most recently, from the games the hub already holds.
 *
 * Active and finished games go in together: the person I am mid-game with is
 * the one most likely to be asked again. Each name appears once, at their latest
 * game, matched without regard to case because that is how the server matches a
 * username. There is no request behind this: the lists are the hub's own.
 */
export function recentOpponentsOf(
  games: Game[],
  myUserId: string,
): RecentOpponent[] {
  const latestByName = new Map<string, RecentOpponent>()

  for (const game of games) {
    const opponent =
      game.black.userId === myUserId ? game.white : game.black
    if (opponent.userId === myUserId) continue

    const key = opponent.name.toLowerCase()
    const known = latestByName.get(key)
    if (known && known.lastPlayedAt >= game.updatedAt) continue

    latestByName.set(key, {
      name: opponent.name,
      avatarUrl: opponent.avatarUrl,
      lastPlayedAt: game.updatedAt,
    })
  }

  return [...latestByName.values()]
    .sort((first, second) => second.lastPlayedAt - first.lastPlayedAt)
    .slice(0, RECENT_OPPONENT_LIMIT)
}
