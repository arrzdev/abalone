import { Screen, ScrollView } from "@repo/nativ/components"
import { createFileRoute } from "@tanstack/react-router"
import { HomeFaq } from "@/components/home/home-faq"
import { PlayPoster } from "@/components/home/play-poster"
import { routeLanguage } from "@/routing/route-language"
import { seoPageHead } from "@/routing/seo-pages"

export const Route = createFileRoute("/_shell/")({
  head: ({ match }) => seoPageHead("/", routeLanguage(match.context)),
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
 * The poster does not scroll: it fills the first screen exactly, and the FAQ
 * sits below it, a scroll away. A poster that scrolls is a page; a poster with
 * a page under it is a front door.
 */
function HomePage() {
  return (
    <Screen inset="safe-x" className="relative">
      {/* Its own layer, not a class on the column: the texture is masked, and
          a mask on the column would fade the hero out with it. */}
      <div className="hex-texture pointer-events-none absolute inset-0" />
      {/* The scroller is a size container so the poster can take exactly its
          height (100cqh), and be the same first screen it was before the FAQ. */}
      <ScrollView className="relative [container-type:size]">
        <div data-home-poster className="flex h-[100cqh] flex-col">
          <PlayPoster />
        </div>
        <HomeFaq />
      </ScrollView>
    </Screen>
  )
}
