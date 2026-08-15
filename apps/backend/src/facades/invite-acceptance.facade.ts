import { CustomError } from "@/http/errors"
import type { Game, GameService } from "@/services/game.service"
import type { InviteService } from "@/services/invite.service"

/**
 * Saying yes to an invite.
 *
 * Two domains in one act: the invite stops existing and a game starts. Neither
 * service may reach into the other's table, so the flow lives here, which is
 * what a facade is for.
 *
 * There is no transaction around the two writes, and that is a choice rather
 * than an omission. A D1 transaction is a batch under the covers, and a batch
 * cannot be built out of two services' statements without one of them handing
 * its table to the other. So the order does the work instead: the game is
 * opened first, and `games.invite_id` is unique, so a retry after a
 * half-finished accept finds the game that already exists rather than opening a
 * second one. The worst a failure leaves behind is an invite that has already
 * become a game, and answering it again clears it.
 */
export class InviteAcceptanceFacade {
  constructor(
    private invites: InviteService,
    private games: GameService,
  ) {}

  /** Accepts an invite addressed to this player, and opens the game. */
  async accept(inviteId: string, userId: string): Promise<Game> {
    //authorization and decision both before anything is written: only the
    //player it was addressed to can answer, and only while it still stands
    const invite = await this.invites.findAddressedTo(inviteId, userId)
    if (!invite) throw new CustomError("not_found")

    const gameId = await this.games.open({
      inviteId: invite.id,
      fromUserId: invite.from.userId,
      toUserId: invite.to.userId,
      side: invite.side,
      setupType: invite.setupType,
    })

    await this.invites.discard(invite.id)

    return this.games.get(gameId, userId)
  }
}
