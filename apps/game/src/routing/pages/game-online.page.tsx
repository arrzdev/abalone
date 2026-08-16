import { createFileRoute, redirect } from "@tanstack/react-router"

/**
 * The old online lobby, which is home now.
 *
 * Kept as a redirect rather than deleted: this path is in the service worker's
 * precache list, in anybody's bookmarks, and in every `?redirect=` an older
 * build of the app ever wrote. A 404 for a URL the app itself handed out is the
 * app breaking its own links.
 *
 * `replace`, so the back button goes wherever they came from rather than to a
 * route that only ever bounces.
 */
export const Route = createFileRoute("/_subpage/game/online/")({
  beforeLoad: () => {
    throw redirect({ to: "/", replace: true })
  },
})
