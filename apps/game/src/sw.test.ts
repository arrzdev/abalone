import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

//the service worker is registration calls and one plugin. the registrations
//are `@repo/nativ/sw`'s, so they are stood in and what this file asked them
//for is read back; the plugin is run for real against a fake cache.

const sw = vi.hoisted(() => ({
  setupPrecache: vi.fn(),
  registerIncrementalNavigationRoute: vi.fn(),
  registerStaticAssetsRoute: vi.fn(),
  registerInstallRouteWarmer: vi.fn(),
  registerServiceWorkerLifecycle: vi.fn(),
  createCacheName: vi.fn(
    (tag: string, bucket: string) => `${tag}:${bucket}`,
  ),
  createNetworkFirstStrategy: vi.fn((options: unknown) => ({
    strategy: options,
  })),
}))

vi.mock("@repo/nativ/sw", () => sw)

type Plugin = {
  handlerDidError: (context: { request: Request }) => Promise<unknown>
}

type Route = {
  buildTag: string
  cacheBucket?: string
  match?: (url: URL) => boolean
  strategy?: { strategy: { plugins: Plugin[]; cacheName: string } }
  offlineFallbackPath: string
  networkTimeoutSeconds?: number
}

const MANIFEST = [{ url: "/assets/app.js", revision: null }]

async function boot() {
  vi.resetModules()
  vi.clearAllMocks()
  vi.stubGlobal("__NATIV_BUILD_TAG__", "build-abc")
  Object.assign(self, { __WB_MANIFEST: MANIFEST })
  await import("@/sw")
}

function routes(): Route[] {
  return sw.registerIncrementalNavigationRoute.mock.calls.map(
    (call) => call[0] as Route,
  )
}

describe("service worker", () => {
  beforeEach(boot)

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("precaches the build's manifest", () => {
    expect(sw.setupPrecache).toHaveBeenCalledWith(MANIFEST)
  })

  it("keys every cache to the build", () => {
    for (const route of routes()) expect(route.buildTag).toBe("build-abc")
    expect(sw.registerStaticAssetsRoute).toHaveBeenCalledWith({
      buildTag: "build-abc",
    })
  })

  it("registers the language-prefixed pages before the catch-all", () => {
    const [prefixed, everything] = routes()

    expect(prefixed.match?.(new URL("https://x.test/pt/rules"))).toBe(true)
    expect(prefixed.match?.(new URL("https://x.test/rules"))).toBe(false)
    expect(everything.match).toBeUndefined()
  })

  it("falls back to the offline page on every navigation", () => {
    for (const route of routes()) {
      expect(route.offlineFallbackPath).toBe("/_pwa/offline-fallback.html")
    }
  })

  it("warms the screens that run with the network off", () => {
    const [{ routes: warmed }] = sw.registerInstallRouteWarmer.mock
      .calls[0] as unknown as [{ routes: string[] }]

    expect(warmed).toEqual(
      expect.arrayContaining(["/", "/offline", "/rules"]),
    )
    //account screens need the backend and are not worth warming
    expect(warmed).not.toContain("/profile")
  })

  it("takes over open pages and updates on message", () => {
    expect(sw.registerServiceWorkerLifecycle).toHaveBeenCalledWith({
      claimClients: true,
      skipWaitingOnMessage: true,
    })
  })

  describe("a language page offline with no copy of its own", () => {
    function plugin(): Plugin {
      return routes()[0].strategy?.strategy.plugins[0] as Plugin
    }

    it("answers with the cached shell of the unprefixed path", async () => {
      const cached = new Response("shell")
      const match = vi.fn(async () => cached)
      vi.stubGlobal("caches", { open: vi.fn(async () => ({ match })) })

      const answer = await plugin().handlerDidError({
        request: new Request("https://abalone.tudu.dev/pt/rules"),
      })

      expect(answer).toBe(cached)
      expect(match).toHaveBeenCalledWith(
        "https://abalone.tudu.dev/rules",
        {
          ignoreVary: true,
        },
      )
    })

    it("looks in the pages cache of this build", async () => {
      const open = vi.fn(async () => ({ match: async () => undefined }))
      vi.stubGlobal("caches", { open })

      await plugin().handlerDidError({
        request: new Request("https://abalone.tudu.dev/de/strategy"),
      })

      expect(open).toHaveBeenCalledWith("build-abc:pages")
    })

    it("has nothing to say when the shell was never cached", async () => {
      vi.stubGlobal("caches", {
        open: async () => ({ match: async () => undefined }),
      })

      const answer = await plugin().handlerDidError({
        request: new Request("https://abalone.tudu.dev/pt/rules"),
      })

      expect(answer).toBeUndefined()
    })

    it("reads the home page of a language as the root", async () => {
      const match = vi.fn(async () => undefined)
      vi.stubGlobal("caches", { open: async () => ({ match }) })

      await plugin().handlerDidError({
        request: new Request("https://abalone.tudu.dev/pt"),
      })

      expect(match).toHaveBeenCalledWith("https://abalone.tudu.dev/", {
        ignoreVary: true,
      })
    })
  })
})
