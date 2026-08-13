import { defineApp } from "@repo/nativ/config"

export default defineApp({
  name: "Abalone",
  description: "Monorepo boilerplate — React PWA on Cloudflare Workers.",
  lang: "en",
  themeColor: { light: "#eeeeec", dark: "#0a0a0c" },
  icons: "./public/favicons",
  orientation: "portrait",
  styles: "./src/styles/main.css",
  sw: "./src/sw.ts",

  splashScreen: () => import("@/components/splash-screen"),
  orientationGuardScreen: () => import("@/components/rotate-guard"),
  notFoundScreen: () => import("@/components/not-found-screen"),
  providers: () => import("@/providers/app-providers"),

  router: {
    render: "ssr",
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
