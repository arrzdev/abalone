import { Screen, ScrollView } from "@repo/nativ/components"
import { useQueryClient } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { Lobby } from "@/components/home/lobby"
import { PlayPoster } from "@/components/home/play-poster"
import { InviteComposer } from "@/components/online/invite-composer"
import { useOnlineHome } from "@/hooks/use-online-home"
import { useAuth } from "@/providers/auth-provider"

/**
 * `?invite=new` opens the composer over the lobby.
 *
 * A search parameter rather than component state because the thing that opens it
 * is usually somewhere else: the Play tab's sheet, or a sign-in that began with
 * "play online" three screens ago. Anything unrecognised is dropped rather than
 * rejected — a stale link should land on home, not on an error.
 */
type HomeSearch = { invite?: "new" }

export const Route = createFileRoute("/_shell/")({
  validateSearch: (search: Record<string, unknown>): HomeSearch => ({
    invite: search.invite === "new" ? "new" : undefined,
  }),
  component: HomePage,
})

/**
 * The front door, and the room behind it.
 *
 * One route, two screens: signed out it is a poster for a game nobody has heard
 * of, and signed in it is the lobby — the games waiting on you, the invites, the
 * history. There is no separate online page any more. A list of your games is
 * the first thing you want on opening the app, and putting it one press away
 * behind a link called "Online" meant the app opened on an advertisement for
 * itself every time.
 *
 * The poster does not scroll and the lobby does. A poster that scrolls is a
 * page, and a lobby that doesn't is a lobby that hides its own history.
 */
function HomePage() {
  const { user } = useAuth()

  if (!user) {
    return (
      <Screen inset="safe-x" className="relative">
        {/* Its own layer, not a class on the column: the texture is masked, and
            a mask on the column would fade the hero out with it. */}
        <div className="hex-texture pointer-events-none absolute inset-0 [--hex-size:88px]" />
        <PlayPoster />
      </Screen>
    )
  }

  return <SignedInHome />
}

/**
 * Everything the lobby reads and everything it can do, held here rather than in
 * `Lobby` so the composer and the panels share one copy of it.
 */
function SignedInHome() {
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
      to: "/",
      search: open ? { invite: "new" } : {},
      replace: true,
    })

  //saying yes opens a game, and the only reason to say yes is to play it — so
  //accepting lands on the board rather than on a new row to find and press
  const acceptAndOpen = (inviteId: string) =>
    online.accept(inviteId, (game) =>
      navigate({
        to: "/game/online/$gameId",
        params: { gameId: game.id },
      }),
    )

  return (
    <Screen className="relative">
      <div className="hex-texture pointer-events-none absolute inset-0 [--hex-size:96px] opacity-[0.035]" />

      <ScrollView className="px-safe" directionalLockEnabled>
        <Lobby
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
