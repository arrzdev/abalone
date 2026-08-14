import { createFileRoute, redirect } from "@tanstack/react-router"

/**
 * `/game` used to be the whole game, and links and installed shortcuts still
 * point at it. It now means offline play, which is what it always was.
 */
export const Route = createFileRoute("/_subpage/game/")({
  beforeLoad: () => {
    throw redirect({ to: "/game/offline", replace: true })
  },
})
