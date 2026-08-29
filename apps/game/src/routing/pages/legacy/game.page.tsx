import { createFileRoute, redirect } from "@tanstack/react-router"

/** `/game` meant offline play, which is what `/offline` says outright. */
export const Route = createFileRoute("/game/")({
  beforeLoad: () => {
    throw redirect({ to: "/offline", replace: true })
  },
})
