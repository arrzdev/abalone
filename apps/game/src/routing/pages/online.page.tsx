import { Screen, ScrollView } from "@repo/nativ/components"
import { useQueryClient } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { Hub } from "@/components/online/hub"
import { InviteComposer } from "@/components/online/invite-composer"
import { useOnlineHome } from "@/hooks/use-online-home"
import { useAuth } from "@/providers/auth-provider"
import { pageHead } from "@/routing/page-head"
import { SignedInOnly } from "@/routing/signed-in-only"

/**
 * `?invite=new` opens the composer over the hub.
 *
 * A search parameter rather than component state because the thing that opens it
 * is usually somewhere else: a button on home, or a sign-in that began with
 * "play online" three screens ago. Anything unrecognised is dropped rather than
 * rejected — a stale link should land on the hub, not on an error.
 */
type OnlineSearch = { invite?: "new" }

export const Route = createFileRoute("/_shell/online")({
  validateSearch: (search: Record<string, unknown>): OnlineSearch => ({
    invite: search.invite === "new" ? "new" : undefined,
  }),
  head: () =>
    pageHead({
      title: "Play online",
      description:
        "Your games, your invites and your record in one place. Invite anyone by username and take your turn whenever you like.",
      path: "/online",
      noIndex: true,
    }),
  component: GuardedOnlinePage,
})

function GuardedOnlinePage() {
  return (
    <SignedInOnly returnTo="/online">
      <OnlinePage />
    </SignedInOnly>
  )
}

/**
 * Where the account lives: the games waiting on you, the invites, the record.
 *
 * It is its own route rather than the signed-in half of home. Home reporting on
 * the account *and* this page doing it was what made home a dashboard, and a
 * dashboard is the wrong first thing for a game nobody has heard of.
 *
 * Everything the hub reads and everything it can do is held here rather than in
 * `Hub`, so the composer and the panels share one copy of it.
 */
function OnlinePage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const { invite } = Route.useSearch()

  const online = useOnlineHome(queryClient)

  //the URL is the open state, so closing means clearing it — otherwise the
  //composer reopens on every back button and every refresh of the same link
  const isComposing = invite === "new"
  const setComposing = (open: boolean) =>
    navigate({
      to: "/online",
      search: open ? { invite: "new" } : {},
      replace: true,
    })

  //saying yes opens a game, and the only reason to say yes is to play it — so
  //accepting lands on the board rather than on a new row to find and press
  const acceptAndOpen = (inviteId: string) =>
    online.accept(inviteId, (game) =>
      navigate({
        to: "/online/$gameId",
        params: { gameId: game.id },
      }),
    )

  return (
    <Screen className="relative">
      <div className="hex-texture pointer-events-none absolute inset-0" />

      {/* `relative`, or the texture lands on top of it: the layer above is
          positioned and this is not, and a positioned box paints over an
          unpositioned sibling whatever the order in the document. The hexes
          then run across the panels and read as cards left half transparent. */}
      <ScrollView className="relative px-safe" directionalLockEnabled>
        <Hub
          online={online}
          myUserId={user?.id ?? ""}
          onCompose={() => setComposing(true)}
          onAccept={acceptAndOpen}
        />
      </ScrollView>

      <InviteComposer
        open={isComposing}
        onClose={() => setComposing(false)}
        pending={online.isSending}
        error={online.composeError}
        onSend={(input) => online.send(input, () => setComposing(false))}
      />
    </Screen>
  )
}
