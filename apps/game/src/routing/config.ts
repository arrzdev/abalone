import { index, layout, rootRoute, route } from "@repo/nativ/routes"

/**
 * `layout()` takes its id explicitly. Given only a file it derives one from the
 * basename and splits it on the first `.`, so `layouts/shell.layout.tsx` would
 * become `/_shell/layout` and quietly move every child to `/layout/rules`.
 */
export const routes = rootRoute([
  //The two screens that wear the app's full bar at every width: the front door,
  //and the hub you keep coming back to. Pathless, so URLs are unchanged.
  //
  //Home is the same page signed in or out. It presents the game and points at
  //the three ways to play; it does not report on the account, because `/online`
  //does that and doing it twice is what made home a dashboard.
  layout("shell", "layouts/shell.layout.tsx", [
    index("pages/home.page.tsx"),
    route("/online", "pages/online.page.tsx"),
  ]),

  //Everything you open from one of those two. The header above `lg` and nothing
  //else; on a phone the page carries its own bar and neither of these rows.
  //
  //`/online/history` and `/online/$gameId` are declared flat rather than nested
  //under the hub, because the hub lives in the other layout and a path cannot
  //be a child of a route in a tree it is not in.
  layout("subpage", "layouts/subpage.layout.tsx", [
    route("/rules", "pages/rules.page.tsx"),
    route("/profile", "pages/profile.page.tsx"),
    route("/offline", "pages/game-offline.page.tsx"),
    route("/online/history", "pages/online-history.page.tsx"),
    route("/online/$gameId", "pages/game-online-board.page.tsx"),
  ]),

  //---- the map before this one ----------------
  //
  //Every path the app used to hand out, kept as a redirect rather than deleted.
  //These are in the service worker's precache list, in bookmarks, in the home
  //screen shortcut somebody installed, and in every `?redirect=` an older build
  //ever wrote. A 404 for a URL the app itself gave out is the app breaking its
  //own links.
  //
  //Outside both layouts: nothing renders on the way through, so there is no
  //reason to mount chrome around it.
  route("/login", "pages/legacy/login.page.tsx"),
  route("/games", "pages/legacy/games.page.tsx"),
  route("/game", [
    index("pages/legacy/game.page.tsx"),
    route("/offline", "pages/legacy/game-offline.page.tsx"),
    route("/online", [
      index("pages/legacy/game-online.page.tsx"),
      route("/$gameId", "pages/legacy/game-online-board.page.tsx"),
    ]),
  ]),
])

export default routes
