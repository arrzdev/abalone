/// <reference lib="webworker" />

import {
  createCacheName,
  createNetworkFirstStrategy,
  registerIncrementalNavigationRoute,
  registerInstallRouteWarmer,
  registerServiceWorkerLifecycle,
  registerStaticAssetsRoute,
  setupPrecache,
} from "@repo/nativ/sw"
import { splitLocalePath } from "@/i18n/locale-path"

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>
}

//injected by the nativ() vite plugin at build time — a content hash of the
//client bundle, so the SW cache namespace tracks the deployed assets.
declare const __NATIV_BUILD_TAG__: string
const BUILD_TAG = __NATIV_BUILD_TAG__
const OFFLINE_FALLBACK = "/_pwa/offline-fallback.html"
const NETWORK_TIMEOUT_SECONDS = 3

setupPrecache(self.__WB_MANIFEST)

//a visit to /pt/rules that finds neither the network nor its own cached copy
//still has the app: the page is the same shell as /rules, and the router reads
//the language off the address it boots on. Without this the offline page
//answers for every language page the visitor has not opened yet
const shellOfUnprefixedPath: NonNullable<
  Parameters<typeof createNetworkFirstStrategy>[0]["plugins"]
>[number] = {
  async handlerDidError({ request }) {
    const { path } = splitLocalePath(new URL(request.url).pathname)
    const pages = await caches.open(createCacheName(BUILD_TAG, "pages"))
    return pages.match(new URL(path, request.url).href, {
      ignoreVary: true,
    })
  },
}

//specific before the catch-all below
registerIncrementalNavigationRoute({
  buildTag: BUILD_TAG,
  cacheBucket: "pages",
  offlineFallbackPath: OFFLINE_FALLBACK,
  match: (url) => splitLocalePath(url.pathname).prefixed,
  strategy: createNetworkFirstStrategy({
    cacheName: createCacheName(BUILD_TAG, "pages"),
    networkTimeoutSeconds: NETWORK_TIMEOUT_SECONDS,
    plugins: [shellOfUnprefixedPath],
  }),
})

//every navigation — offline play talks to no service of ours, so once the
//routes are cached the game runs with the network off. only the account screens
//need the backend, and those degrade to whatever the last session said.
registerIncrementalNavigationRoute({
  buildTag: BUILD_TAG,
  cacheBucket: "pages",
  networkTimeoutSeconds: NETWORK_TIMEOUT_SECONDS,
  offlineFallbackPath: OFFLINE_FALLBACK,
})

registerStaticAssetsRoute({ buildTag: BUILD_TAG })

registerInstallRouteWarmer({
  buildTag: BUILD_TAG,
  cacheBucket: "pages",
  routes: [
    "/",
    "/online",
    "/rules",
    "/strategy",
    "/opening-moves",
    "/play-online",
    "/starting-positions",
    "/offline",
  ],
})

registerServiceWorkerLifecycle({
  claimClients: true,
  skipWaitingOnMessage: true,
})
