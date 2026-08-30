import { createFileRoute, Outlet } from "@tanstack/react-router"
import { AppHeader } from "@/components/app-header"

export const Route = createFileRoute("/_shell")({
  component: ShellLayout,
})

/**
 * The chrome around the two screens that wear the whole of it: the header, at
 * every width.
 *
 * No ambient wash. Two blurred colour blobs used to sit behind this, and what
 * they read as was a stain in one corner: a gradient with no source, aimed at
 * nothing. The honeycomb a page lays down is the texture now, and it is at
 * least the shape of the game.
 *
 * It is a flex child of nativ's app shell, not a viewport of its own — no
 * `h-dvh` here. In standalone the shell is `h-screen`, which includes the
 * home-indicator strip, and `h-dvh` disagrees with it by exactly that inset.
 *
 * The board screens sit outside this layout: there, the board is the screen.
 */
function ShellLayout() {
  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-ground">
      <AppHeader />

      <main className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        <Outlet />
      </main>
    </div>
  )
}
