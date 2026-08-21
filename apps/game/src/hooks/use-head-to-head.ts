import { useQuery } from "@tanstack/react-query"
import type { Game } from "@/data/online/queries"
import { gamesQueryOptions } from "@/data/online/queries"

/**
 * What these two have done to each other before this game.
 *
 * Counted here rather than asked for, because the answer is already on the
 * device: history is fetched once and then believed — a finished game never
 * changes again — so a head-to-head is a pass over a list that is sitting in
 * the cache. A route for it would be a request per game opened for a number
 * this can work out for free.
 *
 * In seat order, not in yours. The card above reads black on the left and white
 * on the right whoever you are, so a record written the other way round would be
 * the one line on it that has to be decoded.
 *
 * Nothing at all for two players who have not met. "0–0" is a fact about an
 * empty list, and putting it under the score says they have history when the
 * point of the line is that they do.
 */
export function useHeadToHead(game: Game | undefined) {
  const { data: finished = [] } = useQuery(gamesQueryOptions("finished"))

  if (!game) return undefined

  const record = countHeadToHead(
    finished,
    game.black.userId,
    game.white.userId,
  )
  if (record.played === 0) return undefined

  return record
}

export type HeadToHead = {
  /** Every finished game between the two, draws included. */
  played: number
  /** Won by whoever holds black in the game being played now. */
  blackWins: number
  whiteWins: number
}

/**
 * The record between two people, counted by who they are rather than by the
 * colours they are holding.
 *
 * Sides change from game to game, so a count kept by seat would credit half of
 * somebody's wins to their opponent. Everything here is keyed on the user id
 * and only mapped back onto this game's seats at the end.
 */
export function countHeadToHead(
  finished: Game[],
  blackId: string,
  whiteId: string,
): HeadToHead {
  const record: HeadToHead = { played: 0, blackWins: 0, whiteWins: 0 }

  for (const past of finished) {
    //the same two people, whichever colours they held that day
    const ids = [past.black.userId, past.white.userId]
    if (!ids.includes(blackId) || !ids.includes(whiteId)) continue

    record.played++
    if (!past.winner) continue

    const winnerId =
      past.winner === "black" ? past.black.userId : past.white.userId
    if (winnerId === blackId) record.blackWins++
    else record.whiteWins++
  }

  return record
}
