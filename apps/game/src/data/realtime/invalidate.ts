import type { RealtimeEvent } from "@repo/backend/realtime/events"
import type { QueryClient } from "@tanstack/react-query"
import type { Game } from "@/data/online/queries"
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

  const key = onlineKeys.game(event.meta.gameId)

  //every event goes to both seats, so the player who just moved is told about
  //their own move — and their mutation already wrote that exact row from the
  //response. without this they would refetch what they are holding, on every
  //move they make. the beacon carries the row's version so an echo is telling
  //apart from news, which is the only reason it carries anything at all.
  const held = queryClient.getQueryData<Game>(key)
  if (held && held.updatedAt >= event.meta.updatedAt) return

  //`exact`, and it matters: the move history is keyed UNDER the game row, so a
  //prefix match would pull the whole history down on every beacon and undo the
  //cheap-row/expensive-history split the api was built around. the row carries
  //`moveCount`, and the board fetches the plies only once that number has moved.
  void queryClient.invalidateQueries({ queryKey: key, exact: true })
}
