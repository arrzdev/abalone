/// <reference lib="webworker" />

import {
  registerIncrementalNavigationRoute,
  registerInstallRouteWarmer,
  registerServiceWorkerLifecycle,
  registerStaticAssetsRoute,
  setupPrecache,
} from "@repo/nativ/sw"

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

//specific paths first — rolling window example:
// registerIncrementalNavigationRoute({
//   buildTag: BUILD_TAG,
//   cacheBucket: "products",
//   pathPrefix: "/products",
//   networkTimeoutSeconds: NETWORK_TIMEOUT_SECONDS,
//   expiration: { maxEntries: 50, maxAgeSeconds: 7 * 24 * 60 * 60 },
// })

//catch-all — permanent incremental cache for every other navigation
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
  routes: ["/", "/settings"],
})

registerServiceWorkerLifecycle({
  claimClients: true,
  skipWaitingOnMessage: true,
})
