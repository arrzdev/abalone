import type { Game } from "@/data/online/queries"

/** The four numbers the profile shows over its name. */
export type ProfileStats = {
  /** Games played out. A game still in progress is not one of them. */
  played: number
  won: number
  /** Games in progress right now, either side's move. */
  playing: number
  /** The longest run of wins there has ever been. */
  bestStreak: number
}

/** Won, lost, or drawn, from the reader's seat. */
function didWin(game: Game, myUserId: string) {
  if (!game.winner) return false
  const seat = game.black.userId === myUserId ? "black" : "white"
  return game.winner === seat
}

/**
 * The profile's numbers, worked out from the games already in hand.
 *
 * They are derived rather than asked for. The server has no stats endpoint, and
 * every one of these is a count of a list this screen has loaded anyway — an
 * endpoint would be a second source for a number the client can already see,
 * and the two would disagree the moment a game finished between the two calls.
 *
 * `finished` arrives newest first, so the streak walks it backwards: a run
 * counted from the front would be the most recent run, not the best one.
 */
export function profileStatsOf(
  finished: Game[],
  active: Game[],
  myUserId: string,
): ProfileStats {
  let won = 0
  let bestStreak = 0
  let currentStreak = 0

  for (let i = finished.length - 1; i >= 0; i--) {
    if (!didWin(finished[i], myUserId)) {
      currentStreak = 0
      continue
    }
    won++
    currentStreak++
    if (currentStreak > bestStreak) bestStreak = currentStreak
  }

  return {
    played: finished.length,
    won,
    playing: active.length,
    bestStreak,
  }
}
