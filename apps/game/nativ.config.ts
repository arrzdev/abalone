import { defineApp } from "@repo/nativ/config"

export default defineApp({
  name: "Abalone",
  description:
    "The two-player strategy game where you push six of your opponent's marbles off the board. Play online, against eight bots, or on one device.",
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

  //---- the card a shared link unfurls into -----
  //
  //The app is a SPA behind one prerendered shell, so this head is the head every
  //URL is served. The renderers behind a chat app or a social post do not run
  //JavaScript, which means what is written here is the card for every path,
  //including the ones whose route sets its own (see `src/routing/page-head.ts`).
  //So it is the front door: the whole page, on a desktop, as the landing looks.
  //
  //Absolute URLs, and the canonical host rather than whichever one served the
  //link: a crawler resolves a relative one against a page it fetched from
  //somewhere else, and the babaluje host is the same game under a joke name, not
  //a second product. `SITE_ORIGIN` in `src/utils/site.ts` is this same string —
  //esbuild loads this file outside the app's aliases, so it cannot import it.
  openGraph: {
    type: "website",
    url: "https://abalone.tudu.dev/",
    image: "https://abalone.tudu.dev/images/social/og-home.jpg",
  },
  twitter: {
    card: "summary_large_image",
  },

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
