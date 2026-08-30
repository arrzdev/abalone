import { createFileRoute, redirect } from "@tanstack/react-router"

/**
 * Signing in stopped being a place to go. It is an overlay over whatever you
 * were doing, so there is no screen at the end of this path any more.
 *
 * The `?redirect=` this URL used to carry is dropped rather than honoured: it
 * named where to land *after* signing in, and nobody is signing in here.
 */
export const Route = createFileRoute("/login")({
  beforeLoad: () => {
    throw redirect({ to: "/", replace: true })
  },
})
