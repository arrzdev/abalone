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

  const gameId = event.meta.gameId
  const key = onlineKeys.game(gameId)

  //every event goes to both seats, so the player who just moved is told about
  //their own move — and the request that caused it is answering with that exact
  //row. a write still in flight is therefore the one thing that will write this
  //version, and its beacon has nothing to add.
  //
  //this is the first check rather than the version one below, because the two
  //are not interchangeable. the fan-out runs in `waitUntil` while the answer to
  //the same request is still on the wire, so an echo routinely lands BEFORE the
  //row it echoes — at which point the versions read as news and the device
  //refetches what it is about to be handed, mid-move.
  if (
    queryClient.isMutating({ mutationKey: onlineKeys.write(gameId) }) > 0
  ) {
    return
  }

  //and once that write has landed, the row it wrote is what says so. the beacon
  //carries the row's version so an echo arriving after the fact — from this
  //device or from another one of the player's — is still told from news.
  const held = queryClient.getQueryData<Game>(key)
  if (held && held.updatedAt >= event.meta.updatedAt) return

  //`exact`, and it matters: the move history is keyed UNDER the game row, so a
  //prefix match would pull the whole history down on every beacon and undo the
  //cheap-row/expensive-history split the api was built around. the row carries
  //`moveCount`, and the board fetches the plies only once that number has moved.
  void queryClient.invalidateQueries({ queryKey: key, exact: true })
}
