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
  /**
   * A game one of the subscribers is playing has moved on.
   *
   * `updatedAt` is the row's version, and it is what lets a client tell news
   * from an echo. Every event goes to both seats, so the player who just moved
   * is told about their own move — and their device already wrote that exact
   * row from the response. Comparing versions is what stops that turning into
   * a refetch of something already in hand.
   *
   * The row's own timestamp rather than a move counter: a resignation changes a
   * game without adding a ply, and anything else that ever changes a game will
   * bump this without having to remember to.
   */
  | { event: "game-updated"; meta: { gameId: string; updatedAt: number } }
  /** An invite the subscriber is party to was sent, declined or withdrawn. */
  | { event: "invites-changed" }
  /** A game opened or finished, so the subscriber's lists have moved. */
  | { event: "games-changed" }
