import type { RealtimeEvent } from "@repo/backend/realtime/events"
import type { QueryClient } from "@tanstack/react-query"
import { onlineKeys } from "@/data/online/queries"

/**
 * Which lists a beacon makes stale.
 *
 * One place, for the same reason invalidation after a mutation lives in one
 * place: which query a piece of news dirties is a fact about the api, not about
 * whichever screen happened to be open when it arrived.
 *
 * A beacon never carries data, so nothing here writes to the cache. It marks
 * things stale and lets the queries the screens already own do the fetching,
 * which keeps the server the only thing that says what a game looks like.
 */
export function applyRealtimeEvent(
  queryClient: QueryClient,
  event: RealtimeEvent,
): void {
  if (event.event === "invites-changed") {
    void queryClient.invalidateQueries({ queryKey: onlineKeys.invites })
    return
  }

  if (event.event === "games-changed") {
    void queryClient.invalidateQueries({
      queryKey: onlineKeys.games("active"),
    })
    void queryClient.invalidateQueries({
      queryKey: onlineKeys.games("finished"),
    })
    return
  }

  //`exact`, and it matters: the move history is keyed UNDER the game row, so a
  //prefix match would pull the whole history down on every beacon and undo the
  //cheap-row/expensive-history split the api was built around. the row carries
  //`moveCount`, and the board fetches the plies only once that number has moved.
  void queryClient.invalidateQueries({
    queryKey: onlineKeys.game(event.meta.gameId),
    exact: true,
  })
}
