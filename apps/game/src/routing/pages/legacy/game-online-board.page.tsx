import { createFileRoute, redirect } from "@tanstack/react-router"

/**
 * The one legacy path that is somebody else's link rather than the app's own:
 * this is the URL a player sent to an opponent to point at a game.
 */
export const Route = createFileRoute("/game/online/$gameId")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/online/$gameId",
      params: { gameId: params.gameId },
      replace: true,
    })
  },
})
