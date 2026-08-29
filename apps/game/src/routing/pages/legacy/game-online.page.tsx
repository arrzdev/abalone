import { createFileRoute, redirect } from "@tanstack/react-router"

/** The old online lobby. The hub is what it grew into. */
export const Route = createFileRoute("/game/online/")({
  beforeLoad: () => {
    throw redirect({ to: "/online", replace: true })
  },
})
