import type { RealtimeEvent } from "@repo/backend/realtime/events"
import type { QueryClient } from "@tanstack/react-query"
import type { Game } from "@/data/online/queries"
import { gameQueryOptions, onlineKeys } from "@/data/online/queries"

/**
 * Which lists a beacon makes stale.
 *
 * One place, for the same reason invalidation after a mutation lives in one
 * place: which query a piece of news dirties is a fact about the api, not about
 * whichever screen happened to be open when it arrived.
 *
 * A beacon never carries data. It marks things stale and lets the queries the
 * screens already own do the fetching, which keeps the server the only thing
 * that says what a game looks like. The one write is the hub's lists: a beacon
 * for one game asks the api for that one game and puts the answer in the lists
 * in place, rather than fetching every game again for one move
 * (`docs/online-hub.md`).
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
  const isRowCurrent =
    held !== undefined && held.updatedAt >= event.meta.updatedAt

  const active = queryClient.getQueryData<Game[]>(
    onlineKeys.games("active"),
  )
  const listed = active?.find((game) => game.id === gameId)

  //a game the list has never seen (a new one, or one accepted elsewhere) has
  //no place to go in place, so the list asks for itself again
  if (active && !listed) {
    void queryClient.invalidateQueries({
      queryKey: onlineKeys.games("active"),
    })
  }

  if (listed && listed.updatedAt < event.meta.updatedAt) {
    if (isRowCurrent) {
      putInHubLists(queryClient, held)
      return
    }

    //one request for both: the answer lands in the row as well, so whatever is
    //watching the row (the board) is handed it without asking a second time
    void queryClient
      .fetchQuery({ ...gameQueryOptions(gameId), staleTime: 0 })
      .then((game) => putInHubLists(queryClient, game))
      .catch(() => {
        //the list's own poll is the fallback; a failed beacon read is not news
      })
    return
  }

  if (isRowCurrent) return

  //`exact`, and it matters: the move history is keyed UNDER the game row, so a
  //prefix match would pull the whole history down on every beacon and undo the
  //cheap-row/expensive-history split the api was built around. the row carries
  //`moveCount`, and the board fetches the plies only once that number has moved.
  void queryClient.invalidateQueries({ queryKey: key, exact: true })
}

/**
 * Put the api's answer for one game where the hub reads it.
 *
 * A game still on stays where it is in the active list. One that just ended
 * leaves it and goes to the top of the finished list, when that list is held;
 * when it is not, the next look at history asks for it anyway. An answer older
 * than what a list already shows (two beacons, answered out of order) is
 * dropped.
 */
function putInHubLists(queryClient: QueryClient, game: Game): void {
  const isNewer = (entry: Game) =>
    entry.id === game.id && entry.updatedAt <= game.updatedAt

  if (game.status === "finished") {
    queryClient.setQueryData<Game[]>(onlineKeys.games("active"), (list) =>
      list?.filter((entry) => !isNewer(entry)),
    )
    queryClient.setQueryData<Game[]>(
      onlineKeys.games("finished"),
      (list) =>
        list && [game, ...list.filter((entry) => entry.id !== game.id)],
    )
    return
  }

  queryClient.setQueryData<Game[]>(onlineKeys.games("active"), (list) =>
    list?.map((entry) => (isNewer(entry) ? game : entry)),
  )
}
