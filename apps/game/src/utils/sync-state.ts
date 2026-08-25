/**
 * How much of what is on screen has been confirmed with the server.
 *
 * The app paints from a cache it saved to disk, which is what makes a cold
 * start instant and a finished game readable with the network off. The cost is
 * that a screen can be complete and wrong at the same time: the last lobby this
 * device was given, drawn as though it were the lobby as it stands now. This is
 * the difference between the two, so a screen can say which one it is showing.
 */
export type SyncState =
  /** Confirmed with the server since this screen opened. */
  | "fresh"
  /** Nothing saved to show, and the first answer has not landed. */
  | "loading"
  /** A saved copy is on screen and the server is being asked about it. */
  | "syncing"
  /** A saved copy is on screen and there is no network to check it against. */
  | "offline"
  /** A saved copy is on screen and the last attempt to check it failed. */
  | "stale"

/**
 * The part of a query result this reads.
 *
 * Structural rather than `UseQueryResult`, so a caller hands over the queries it
 * already holds and nothing has to be rebuilt into a shape. `data` is widened
 * because what a query returns is not this module's business, only whether it
 * returned anything at all.
 */
export type SyncSource = {
  data: unknown
  isError: boolean
  isFetching: boolean
  isFetchedAfterMount: boolean
  isPaused: boolean
}

/**
 * Where a screen's queries, taken together, leave it.
 *
 * `isFetchedAfterMount` is the whole question. A restored cache arrives with its
 * data already in place and that flag false, which is exactly the screen that
 * looks current and is not — every other loading flag reads as settled.
 *
 * The worst of the queries wins, because a screen is only as current as the
 * least current thing on it.
 */
export function syncStateOf(sources: SyncSource[]): SyncState {
  const unconfirmed = sources.filter(
    (source) => !source.isFetchedAfterMount,
  )
  if (unconfirmed.length === 0) return "fresh"

  //paused is the browser saying there is no network: the request has not failed
  //and is not going to be made either
  if (unconfirmed.some((source) => source.isPaused)) return "offline"

  //still failing rather than merely having failed. a retry in flight is a
  //question nobody has answered yet, not one that came back empty.
  const failed = unconfirmed.some(
    (source) => source.isError && !source.isFetching,
  )
  if (failed) return "stale"

  if (unconfirmed.some((source) => source.data === undefined)) {
    return "loading"
  }

  //unconfirmed, nothing in flight, nothing wrong: the cache holds this copy to
  //be inside its own freshness window and has decided not to ask. that is the
  //cache working rather than a screen worth putting a notice on, and it is also
  //what a query cached forever — a finished game's plies — looks like every time
  if (!unconfirmed.some((source) => source.isFetching)) return "fresh"

  return "syncing"
}
