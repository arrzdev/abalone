import { defineApp } from "@repo/nativ/config"

export default defineApp({
  name: "Abalone",
  description:
    "Play Abalone — the two-player strategy game where you push your opponent's marbles off the board.",
  lang: "en",
  //one colour for both appearances: the game is dark, and always has been. the
  //value is the chrome's own grey (--color-chrome), not the shell's: the
  //browser paints this behind the status bar and under the home indicator,
  //which is exactly where the header and the tab bar end — so the app runs edge
  //to edge instead of ending in a lighter band at each end.
  themeColor: { dark: "#141414" },
  defaultThemePreference: "dark",
  //no orientation lock — the board is square-ish and the panel moves beside it
  //above `lg` and under it below, so both ways round are real layouts.
  icons: "./public/favicons",
  styles: "./src/styles/main.css",
  sw: "./src/sw.ts",

  //no splash screen: there is nothing to wait for — no session to restore, no
  //database to open — so an overlay on top of the boot would only be something
  //standing between a tap on the icon and the menu.
  notFoundScreen: () => import("@/components/not-found-screen"),
  providers: () => import("@/providers/app-providers"),

  router: {
    //spa, not ssr: the board is a canvas painted from a requestAnimationFrame
    //loop and the opponent is a web worker. there is nothing here a server can
    //usefully render, and a prerendered shell + hydrate is the whole benefit.
    render: "spa",
    //route generator (nativ routes these to the vite plugin)
    generatedRouteTree: "./routing/routeTree.gen.ts",
    routesDirectory: "./routing",
    virtualRouteConfig: "./src/routing/config.ts",
    quoteStyle: "double",
    //runtime — createRouter
    memoryHistoryInStandalone: true,
    defaultPreload: "viewport",
    defaultPreloadStaleTime: Number.POSITIVE_INFINITY,
  },
})
