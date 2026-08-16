import { createFileRoute, Outlet } from "@tanstack/react-router"
import { AppHeader } from "@/components/app-header"

export const Route = createFileRoute("/_subpage")({
  component: SubpageLayout,
})

/**
 * Everything that is not the home screen: the rules, the login form, the board.
 *
 * A desktop keeps the app header on all of them. It is the only navigation up
 * there, and it holds the mark, the rules, the settings, the language and the
 * account — dropping it the moment a game starts leaves a screen whose one way
 * out is a chevron inside a panel.
 *
 * A phone gets neither the header nor the tab bar here, and a {@link
 * SubpageHeader} at the top of the page instead: back, and what the screen is.
 * Two rows of chrome around one screenful is a board with nowhere to be, and a
 * tab bar under a page you reached from the tab bar is a row of ways to leave
 * before you have read anything.
 */
function SubpageLayout() {
  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-ground">
      <AppHeader className="max-lg:hidden" />

      <main className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        <Outlet />
      </main>
    </div>
  )
}
