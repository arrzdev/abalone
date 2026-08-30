import type { PlayableSetup } from "@repo/abalone-engine/board-setups"
import type { CellName } from "@repo/abalone-engine/types"
import { mutationOptions } from "@tanstack/react-query"
import { api, apiError, withClientRequest } from "@/data/backend-client"
import type { Game, Invite } from "@/data/online/queries"

/** Which side the sender takes. `random` is only resolved once a game opens. */
export type InviteSide = "black" | "white" | "random"

export type SendInviteInput = {
  username: string
  setupType: PlayableSetup
  side: InviteSide
}

export type PlayMoveInput = {
  gameId: string
  marbles: CellName[]
  destination: CellName
  /** Which position the board was showing. The server refuses a stale one. */
  moveIndex: number
}

//every one of these attaches its invalidation at the call site, the way the
//profile mutations do: what a screen has to refetch is the screen's business,
//and the same mutation is fired from more than one of them.

/** Ask somebody to play. */
export const sendInviteMutationOptions = mutationOptions({
  mutationFn: async (input: SendInviteInput): Promise<Invite> => {
    const response = await withClientRequest(() =>
      api.api.v1.invites.$post({ json: input }),
    )
    const body = await response.json()
    if (body.status !== "success") throw apiError(body.error_code)
    return body.data.invite
  },
})

/** Turn down an invite you were sent. */
export const declineInviteMutationOptions = mutationOptions({
  mutationFn: async (inviteId: string): Promise<Invite> => {
    const response = await withClientRequest(() =>
      api.api.v1.invites[":id"].$patch({
        param: { id: inviteId },
        json: { status: "declined" },
      }),
    )
    const body = await response.json()
    if (body.status !== "success") throw apiError(body.error_code)
    return body.data.invite
  },
})

/**
 * Take back an invite you sent.
 *
 * The same request whether it is still waiting or has already been turned
 * down, because both are the row you sent leaving.
 */
export const removeInviteMutationOptions = mutationOptions({
  mutationFn: async (inviteId: string): Promise<void> => {
    const response = await withClientRequest(() =>
      api.api.v1.invites[":id"].$delete({ param: { id: inviteId } }),
    )
    const body = await response.json()
    if (body.status !== "success") throw apiError(body.error_code)
  },
})

/** Say yes, which is what opens the game. */
export const acceptInviteMutationOptions = mutationOptions({
  mutationFn: async (inviteId: string): Promise<Game> => {
    const response = await withClientRequest(() =>
      api.api.v1.games.$post({ json: { inviteId } }),
    )
    const body = await response.json()
    if (body.status !== "success") throw apiError(body.error_code)
    return body.data.game
  },
})

/** Play a move. What comes back is the position the server settled on. */
export const playMoveMutationOptions = mutationOptions({
  mutationFn: async ({
    gameId,
    ...move
  }: PlayMoveInput): Promise<Game> => {
    const response = await withClientRequest(() =>
      api.api.v1.games[":id"].moves.$post({
        param: { id: gameId },
        json: move,
      }),
    )
    const body = await response.json()
    if (body.status !== "success") throw apiError(body.error_code)
    return body.data.game
  },
})

/** Give the game up. */
export const resignGameMutationOptions = mutationOptions({
  mutationFn: async (gameId: string): Promise<Game> => {
    const response = await withClientRequest(() =>
      api.api.v1.games[":id"].resignation.$post({
        param: { id: gameId },
      }),
    )
    const body = await response.json()
    if (body.status !== "success") throw apiError(body.error_code)
    return body.data.game
  },
})
