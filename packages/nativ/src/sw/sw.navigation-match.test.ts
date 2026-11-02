import { describe, expect, it } from "vitest"
import { createNavigationRouteMatch } from "#nativ/sw/sw.navigation-match"

function navigationTo(path: string, mode: RequestMode = "navigate") {
  return {
    url: new URL(path, "https://app.test"),
    request: { mode } as Request,
  }
}

describe("createNavigationRouteMatch", () => {
  it("never matches a request that is not a navigation", () => {
    const matches = createNavigationRouteMatch()

    expect(matches(navigationTo("/", "cors"))).toBe(false)
  })

  it("matches every navigation when given no options", () => {
    const matches = createNavigationRouteMatch()

    expect(matches(navigationTo("/anything/at/all"))).toBe(true)
  })

  it("matches the prefix itself and paths under it, not lookalikes", () => {
    const matches = createNavigationRouteMatch({ pathPrefix: "/products" })

    expect(matches(navigationTo("/products"))).toBe(true)
    expect(matches(navigationTo("/products/123"))).toBe(true)
    expect(matches(navigationTo("/products-sale"))).toBe(false)
    expect(matches(navigationTo("/"))).toBe(false)
  })

  it("matches by pattern before prefix", () => {
    const matches = createNavigationRouteMatch({
      pathPattern: /^\/game\/\d+$/,
      pathPrefix: "/rules",
    })

    expect(matches(navigationTo("/game/42"))).toBe(true)
    expect(matches(navigationTo("/rules"))).toBe(false)
  })

  it("hands full control to a custom match", () => {
    const matches = createNavigationRouteMatch({
      match: (url) => url.searchParams.has("cache"),
      pathPrefix: "/products",
    })

    expect(matches(navigationTo("/products"))).toBe(false)
    expect(matches(navigationTo("/other?cache=1"))).toBe(true)
  })
})
