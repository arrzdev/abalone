/**
 * What the server tells a subscriber, and deliberately nothing more.
 *
 * A beacon rather than a payload: the channel says something changed and names
 * only what is needed to tell whether the client is behind. The row itself
 * still comes from the api the client already trusts, so there is one source
 * of truth instead of two that can disagree — and a socket that relays no
 * game data cannot leak one.
 *
 * This is the contract the game app reads, via the `./realtime/events` export.
 */
export type RealtimeEvent =
  /** A game one of the subscribers is playing has moved on. */
  | { event: "game-updated"; meta: { gameId: string; moveCount: number } }
  /** An invite the subscriber is party to was sent, declined or withdrawn. */
  | { event: "invites-changed" }
  /** A game opened or finished, so the subscriber's lists have moved. */
  | { event: "games-changed" }
