import type { QueryClient } from "@tanstack/react-query"
import { useMutation, useQuery } from "@tanstack/react-query"
import { useMemo } from "react"
import type { SendInviteInput } from "@/data/online/mutations"
import {
  acceptInviteMutationOptions,
  declineInviteMutationOptions,
  removeInviteMutationOptions,
  sendInviteMutationOptions,
} from "@/data/online/mutations"
import type { Game, Invite } from "@/data/online/queries"
import {
  gamesQueryOptions,
  INVITE_POLL_MS,
  invitesQueryOptions,
  onlineKeys,
} from "@/data/online/queries"
import { useApiError } from "@/hooks/use-api-error"
import { useAuth } from "@/providers/auth-provider"
import { useRealtime } from "@/providers/realtime-provider"

export type OnlineHome = {
  activeGames: Game[]
  finishedGames: Game[]
  /** Invites addressed to this player. */
  received: Invite[]
  /** Invites this player sent, including the ones turned down. */
  sent: Invite[]
  /** A row action is in flight, so the rows are not worth pressing again. */
  isBusy: boolean
  isSending: boolean
  /** Whatever the last list or row action said, already translated. */
  error?: string
  /** The same, for the composer, so it lands under the field it is about. */
  composeError?: string
  /** Says yes, then hands back the game it opened so the caller can go there. */
  accept: (inviteId: string, onOpened: (game: Game) => void) => void
  decline: (inviteId: string) => void
  remove: (inviteId: string) => void
  send: (input: SendInviteInput, onSent: () => void) => void
}

/**
 * Everything the online index reads and everything it can do.
 *
 * The screen is four lists off two queries and four mutations, and holding that
 * together in the page would bury the markup. What it keeps out of the page in
 * particular is the invalidation: which list a given action makes stale is a
 * fact about the api, not about the layout.
 */
export function useOnlineHome(queryClient: QueryClient): OnlineHome {
  const { user } = useAuth()
  const translateError = useApiError()

  //the timer is the fallback now, not the mechanism: while the channel is up
  //the server says when a list moved, and asking every fifteen seconds on top
  //of that is asking a question already answered. it comes straight back if the
  //socket drops, which is why the interval is turned off rather than removed.
  const { isConnected } = useRealtime()
  const pollInterval = isConnected ? (false as const) : INVITE_POLL_MS

  const invites = useQuery({
    ...invitesQueryOptions,
    refetchInterval: pollInterval,
  })
  const activeGames = useQuery({
    ...gamesQueryOptions("active"),
    refetchInterval: pollInterval,
  })
  //history is already never polled, so a channel changes nothing for it
  const finishedGames = useQuery(gamesQueryOptions("finished"))

  const refreshInvites = () =>
    queryClient.invalidateQueries({ queryKey: onlineKeys.invites })

  const send = useMutation({
    ...sendInviteMutationOptions,
    onSuccess: refreshInvites,
  })

  const decline = useMutation({
    ...declineInviteMutationOptions,
    onSuccess: refreshInvites,
  })

  const remove = useMutation({
    ...removeInviteMutationOptions,
    onSuccess: refreshInvites,
  })

  const accept = useMutation({
    ...acceptInviteMutationOptions,
    //saying yes ends an invite and starts a game, so both lists move. the row
    //is seeded too, so the board it opens paints from it rather than spinning.
    onSuccess: async (game) => {
      queryClient.setQueryData(onlineKeys.game(game.id), game)
      await refreshInvites()
      await queryClient.invalidateQueries({
        queryKey: onlineKeys.games("active"),
      })
    },
  })

  const myUserId = user?.id
  const { received, sent } = useMemo(() => {
    const all = invites.data ?? []
    return {
      received: all.filter((invite) => invite.to.userId === myUserId),
      //newest first, so the one just sent is the one at the top of the list —
      //the server hands them over oldest first, which buries it
      sent: all
        .filter((invite) => invite.from.userId === myUserId)
        .sort((a, b) => b.createdAt - a.createdAt),
    }
  }, [invites.data, myUserId])

  //one slot for the whole screen: only one of these can have just failed, and
  //four error lines stacked down the page would be four ways of saying it
  const failure =
    accept.error ??
    decline.error ??
    remove.error ??
    invites.error ??
    activeGames.error ??
    finishedGames.error

  return {
    activeGames: activeGames.data ?? [],
    finishedGames: finishedGames.data ?? [],
    received,
    sent,
    isBusy: accept.isPending || decline.isPending || remove.isPending,
    isSending: send.isPending,
    error: failure ? translateError(failure) : undefined,
    composeError: send.error ? translateError(send.error) : undefined,
    accept: (inviteId, onOpened) =>
      accept.mutate(inviteId, { onSuccess: onOpened }),
    decline: (inviteId) => decline.mutate(inviteId),
    remove: (inviteId) => remove.mutate(inviteId),
    send: (input, onSent) => send.mutate(input, { onSuccess: onSent }),
  }
}
