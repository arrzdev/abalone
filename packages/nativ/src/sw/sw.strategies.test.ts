import { ExpirationPlugin } from "workbox-expiration"
import {
  CacheFirst,
  NetworkFirst,
  StaleWhileRevalidate,
} from "workbox-strategies"
import { describe, expect, it } from "vitest"
import { createCacheName } from "#nativ/sw/sw.cache-name"
import { createExpirationPlugins } from "#nativ/sw/sw.expiration"
import { createCacheOkResponsesPlugin } from "#nativ/sw/sw.plugins"
import {
  createCacheFirstStrategy,
  createNetworkFirstStrategy,
  createPagesNetworkFirstStrategy,
  createStaleWhileRevalidateStrategy,
  createStaticStaleWhileRevalidateStrategy,
} from "#nativ/sw/sw.strategies"

describe("createCacheName", () => {
  it("namespaces the bucket by build tag", () => {
    expect(createCacheName("abc123", "pages")).toBe("pages-abc123")
  })
})

describe("createCacheOkResponsesPlugin", () => {
  const { cacheWillUpdate } = createCacheOkResponsesPlugin()
  const willCache = (response: Response) =>
    cacheWillUpdate?.({ response } as Parameters<
      NonNullable<typeof cacheWillUpdate>
    >[0])

  it("keeps a 200 response", async () => {
    const response = new Response("ok", { status: 200 })

    await expect(willCache(response)).resolves.toBe(response)
  })

  it("drops anything that is not a 200", async () => {
    await expect(
      willCache(new Response("", { status: 404 })),
    ).resolves.toBe(null)
    await expect(
      willCache(new Response("", { status: 302 })),
    ).resolves.toBe(null)
  })
})

describe("createExpirationPlugins", () => {
  it("adds nothing for a permanent cache", () => {
    expect(createExpirationPlugins(undefined)).toEqual([])
  })

  it("adds one expiration plugin for a rolling window", () => {
    const plugins = createExpirationPlugins({ maxEntries: 10 })

    expect(plugins).toHaveLength(1)
    expect(plugins[0]).toBeInstanceOf(ExpirationPlugin)
  })
})

describe("strategy factories", () => {
  it("builds each strategy with the ok-only plugin and ignoreVary on", () => {
    const options = { cacheName: "c" }

    for (const [strategy, type] of [
      [createNetworkFirstStrategy(options), NetworkFirst],
      [createStaleWhileRevalidateStrategy(options), StaleWhileRevalidate],
      [createCacheFirstStrategy(options), CacheFirst],
    ] as const) {
      expect(strategy).toBeInstanceOf(type)
      expect(strategy.cacheName).toBe("c")
      expect(strategy.plugins).toHaveLength(1)
      expect(strategy.matchOptions).toEqual({ ignoreVary: true })
    }
  })

  it("adds expiration and caller plugins after the ok-only plugin", () => {
    const callerPlugin = {}
    const strategy = createCacheFirstStrategy({
      cacheName: "c",
      expiration: { maxAgeSeconds: 60 },
      plugins: [callerPlugin],
      matchOptions: { ignoreSearch: true },
    })

    expect(strategy.plugins).toHaveLength(3)
    expect(strategy.plugins[1]).toBeInstanceOf(ExpirationPlugin)
    expect(strategy.plugins[2]).toBe(callerPlugin)
    expect(strategy.matchOptions).toEqual({
      ignoreVary: true,
      ignoreSearch: true,
    })
  })

  it("names the pages and static caches by bucket and build tag", () => {
    expect(createPagesNetworkFirstStrategy("v1").cacheName).toBe(
      "pages-v1",
    )
    expect(
      createPagesNetworkFirstStrategy("v1", { cacheBucket: "docs" })
        .cacheName,
    ).toBe("docs-v1")
    expect(createStaticStaleWhileRevalidateStrategy("v1").cacheName).toBe(
      "static-v1",
    )
    expect(
      createStaticStaleWhileRevalidateStrategy("v1", {
        cacheBucket: "img",
      }).cacheName,
    ).toBe("img-v1")
  })
})
