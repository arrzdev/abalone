import { Screen } from "@repo/nativ/components"
import { createFileRoute } from "@tanstack/react-router"
import { PlayPoster } from "@/components/home/play-poster"

export const Route = createFileRoute("/_shell/")({
  component: HomePage,
})

/**
 * The front door, and the same page signed in or out.
 *
 * It presents the game and points at the three ways to play. It does not report
 * on the account, because `/online` does that, and doing it twice is what turned
 * home into a dashboard: a player who had not signed in met an advertisement,
 * and one who had met a list of chores.
 *
 * It does not scroll. A poster that scrolls is a page.
 */
function HomePage() {
  return (
    <Screen inset="safe-x" className="relative">
      {/* Its own layer, not a class on the column: the texture is masked, and
          a mask on the column would fade the hero out with it. */}
      <div className="hex-texture pointer-events-none absolute inset-0 [--hex-size:88px]" />
      <PlayPoster />
    </Screen>
  )
}
