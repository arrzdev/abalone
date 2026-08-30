import type { Game, Invite } from "@/data/online/queries"

/** Which set of things the hub gives the top of the page to. */
export type HubLead = "games" | "invites" | "none"

export type HubGroups = {
  /** Games it is your turn in, the one that has waited longest first. */
  yourMove: Game[]
  /** The rest, in the order the server sent them. */
  theirMove: Game[]
  /** Received invites, minus any the lead block is already showing. */
  panelInvites: Invite[]
  lead: HubLead
}

function seatOf(game: Game, myUserId: string) {
  return game.black.userId === myUserId ? "black" : "white"
}

function isMyTurn(game: Game, myUserId: string) {
  return game.currentTurn === seatOf(game, myUserId)
}

/**
 * The hub, split into what needs you and what does not.
 *
 * The old lobby sorted one list, which meant a game you cannot touch sat in the
 * same shape as a game waiting on your move and was told apart by a caption.
 * Splitting is what lets the two be different sizes: whatever needs you becomes
 * the page, and everything else becomes a panel at a third of the weight.
 *
 * Only one thing can be the lead, and the ladder is a move you owe, then an
 * answer you owe, then nothing. A move is further along than an invite — it is
 * a game somebody is already playing with you — and both at full size would be
 * two pages stacked with no way to tell which one is the page.
 *
 * Your own games sort by how long they have waited rather than by what moved
 * most recently. The most recent is the one you just looked at; the oldest is
 * the one the other player has been waiting on since Tuesday.
 */
export function hubGroupsOf(
  activeGames: Game[],
  received: Invite[],
  myUserId: string,
): HubGroups {
  const yourMove = activeGames
    .filter((game) => isMyTurn(game, myUserId))
    .sort((a, b) => a.updatedAt - b.updatedAt)

  const theirMove = activeGames.filter((game) => !isMyTurn(game, myUserId))

  let lead: HubLead = "none"
  if (yourMove.length > 0) lead = "games"
  else if (received.length > 0) lead = "invites"

  return {
    yourMove,
    theirMove,
    panelInvites: lead === "invites" ? [] : received,
    lead,
  }
}
