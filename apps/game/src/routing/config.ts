import { index, layout, rootRoute, route } from "@repo/nativ/routes"

/**
 * `layout()` takes its id explicitly. Given only a file it derives one from the
 * basename and splits it on the first `.`, so `layouts/shell.layout.tsx` would
 * become `/_shell/layout` and quietly move every child to `/layout/rules`.
 */
export const routes = rootRoute([
  //The home screen, and the only one that wears the app's full chrome: the
  //header, and the tab bar below `lg`. Pathless, so URLs are unchanged.
  layout("shell", "layouts/shell.layout.tsx", [
    index("pages/home.page.tsx"),
  ]),

  //Everything you get to from it. The header above `lg` and nothing else; on a
  //phone the page carries its own bar and neither of these rows.
  layout("subpage", "layouts/subpage.layout.tsx", [
    route("/rules", "pages/rules.page.tsx"),
    route("/login", "pages/login.page.tsx"),
    route("/game", [
      index("pages/game-redirect.page.tsx"),
      route("/offline", "pages/game-offline.page.tsx"),
      route("/online", [
        index("pages/game-online.page.tsx"),
        route("/$gameId", "pages/game-online-board.page.tsx"),
      ]),
    ]),
  ]),
])

export default routes
