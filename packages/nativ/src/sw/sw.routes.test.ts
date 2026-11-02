import type { Strategy } from "workbox-strategies"
import { NetworkFirst } from "workbox-strategies"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { registerIncrementalNavigationRoute } from "#nativ/sw/sw.navigation"
import { setupPrecache } from "#nativ/sw/sw.precache"
import { registerStaticAssetsRoute } from "#nativ/sw/sw.static-assets"

//workbox's routing and precache keep global state inside a real service
//worker; here they are spies so the tests read what nativ registers
const workbox = vi.hoisted(() => ({
  registerRoute: vi.fn(),
  matchPrecache: vi.fn(),
  precacheAndRoute: vi.fn(),
  cleanupOutdatedCaches: vi.fn(),
}))

vi.mock("workbox-routing", () => ({
  registerRoute: workbox.registerRoute,
}))
vi.mock("workbox-precaching", () => ({
  matchPrecache: workbox.matchPrecache,
  precacheAndRoute: workbox.precacheAndRoute,
  cleanupOutdatedCaches: workbox.cleanupOutdatedCaches,
}))

const ORIGIN = "https://app.test"

type Handler = (options: {
  request: Request
  event: ExtendableEvent
}) => Promise<Response>

function registeredRoute() {
  const [match, handler] = workbox.registerRoute.mock.calls.at(-1) ?? []
  return {
    match: match as (options: { url: URL; request: Request }) => boolean,
    handler: handler as Handler,
  }
}

function strategyResolving(handle: () => Promise<Response | undefined>) {
  return { handle: vi.fn(handle) } as unknown as Strategy
}

const handlerOptions = {
  request: {} as Request,
  event: {} as ExtendableEvent,
}

beforeEach(() => {
  vi.stubGlobal("self", { location: { origin: ORIGIN } })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe("registerIncrementalNavigationRoute", () => {
  it("defaults to a network first pages cache named by build tag", () => {
    const { cacheName, strategy } = registerIncrementalNavigationRoute({
      buildTag: "v1",
    })

    expect(cacheName).toBe("pages-v1")
    expect(strategy).toBeInstanceOf(NetworkFirst)
    expect(strategy.cacheName).toBe("pages-v1")
  })

  it("routes only the navigations its match options own", () => {
    registerIncrementalNavigationRoute({
      buildTag: "v1",
      pathPrefix: "/game",
    })
    const { match } = registeredRoute()
    const navigate = { mode: "navigate" } as Request

    expect(
      match({ url: new URL("/game/1", ORIGIN), request: navigate }),
    ).toBe(true)
    expect(
      match({ url: new URL("/rules", ORIGIN), request: navigate }),
    ).toBe(false)
  })

  it("serves what the strategy returns", async () => {
    const page = new Response("page")
    const strategy = strategyResolving(async () => page)
    registerIncrementalNavigationRoute({ buildTag: "v1", strategy })

    await expect(registeredRoute().handler(handlerOptions)).resolves.toBe(
      page,
    )
    expect(workbox.matchPrecache).not.toHaveBeenCalled()
  })

  it("falls back to the precached offline page when network and cache miss", async () => {
    const offline = new Response("offline")
    workbox.matchPrecache.mockResolvedValue(offline)
    const strategy = strategyResolving(async () => {
      throw new Error("no-response")
    })
    registerIncrementalNavigationRoute({
      buildTag: "v1",
      strategy,
      offlineFallbackPath: "/offline",
    })

    await expect(registeredRoute().handler(handlerOptions)).resolves.toBe(
      offline,
    )
    expect(workbox.matchPrecache).toHaveBeenCalledWith(`${ORIGIN}/offline`)
  })

  it("returns a network error when there is nothing to fall back to", async () => {
    const strategy = strategyResolving(async () => undefined)
    registerIncrementalNavigationRoute({ buildTag: "v1", strategy })

    const response = await registeredRoute().handler(handlerOptions)

    expect(response.type).toBe("error")
  })

  it("returns a network error when the offline page is not precached", async () => {
    workbox.matchPrecache.mockResolvedValue(undefined)
    const strategy = strategyResolving(async () => undefined)
    registerIncrementalNavigationRoute({
      buildTag: "v1",
      strategy,
      offlineFallbackPath: "/offline",
    })

    const response = await registeredRoute().handler(handlerOptions)

    expect(response.type).toBe("error")
  })
})

describe("registerStaticAssetsRoute", () => {
  it("routes static assets to a stale while revalidate cache", () => {
    const { strategy } = registerStaticAssetsRoute({
      buildTag: "v1",
      excludePathPrefixes: ["/private/"],
    })
    const [match, registeredStrategy] =
      workbox.registerRoute.mock.calls.at(-1) ?? []
    const script = {
      method: "GET",
      mode: "cors",
      destination: "script",
    } as Request

    expect(registeredStrategy).toBe(strategy)
    expect(strategy.cacheName).toBe("static-v1")
    expect(
      match({ url: new URL("/app.js", ORIGIN), request: script }),
    ).toBe(true)
    expect(
      match({ url: new URL("/private/app.js", ORIGIN), request: script }),
    ).toBe(false)
  })
})

describe("setupPrecache", () => {
  it("precaches the build manifest and drops outdated caches", () => {
    const manifest = [{ url: "/index.html", revision: "1" }]

    setupPrecache(manifest)

    expect(workbox.precacheAndRoute).toHaveBeenCalledWith(manifest)
    expect(workbox.precacheAndRoute.mock.calls[0]?.[0]).not.toBe(manifest)
    expect(workbox.cleanupOutdatedCaches).toHaveBeenCalledOnce()
  })
})
