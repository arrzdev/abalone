import type { GameService } from "@/services/game.service"
import type { InviteLinkService } from "@/services/invite-link.service"

/** What accepting a link produced, and for whom. */
export type InviteLinkAcceptance = {
  gameId: string
  /** False when this player had already used the link: a retry. */
  opened: boolean
  /** Both players, so the caller can tell them their games moved. */
  playerIds: [string, string]
}

/**
 * Saying yes to an invite link.
 *
 * Two domains in one act, like `InviteAcceptanceFacade`: the link is used up
 * and a game starts, and neither service reaches into the other's table.
 *
 * Not one batch, on purpose. A batch cannot branch on the rows an update
 * changed, so the game insert would run even when the claim lost. The claim is
 * the decision, one conditional update that exactly one player wins; the game
 * write after it is idempotent, because `games.invite_id` is unique. A failure
 * between the two leaves a claimed link with no game, and the same player
 * asking again opens it.
 */
export class InviteLinkAcceptanceFacade {
  constructor(
    private links: InviteLinkService,
    private games: GameService,
  ) {}

  /** Accepts a link for this player, and opens or finds the game. */
  async accept(
    linkId: string,
    userId: string,
  ): Promise<InviteLinkAcceptance> {
    const claimed = await this.links.claim(linkId, userId)
    //throws the reason it could not be claimed, unless this player already did
    const link =
      claimed ?? (await this.links.explainUnclaimed(linkId, userId))
    const playerIds: [string, string] = [link.fromUserId, userId]

    if (link.gameId)
      return { gameId: link.gameId, opened: false, playerIds }

    const gameId = await this.games.open({
      inviteId: link.id,
      fromUserId: link.fromUserId,
      toUserId: userId,
      side: link.side,
      setupType: link.setupType,
    })
    await this.links.attachGame(link.id, gameId)

    return { gameId, opened: claimed !== null, playerIds }
  }
}
