import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createStaticAssetMatcher } from "#nativ/sw/sw.matchers"

const ORIGIN = "https://app.test"

function assetRequest(
  path: string,
  request: Partial<Pick<Request, "method" | "mode" | "destination">> = {},
) {
  return [
    new URL(path, ORIGIN),
    {
      method: "GET",
      mode: "cors",
      destination: "",
      ...request,
    } as Request,
  ] as const
}

beforeEach(() => {
  vi.stubGlobal("self", { location: { origin: ORIGIN } })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("createStaticAssetMatcher", () => {
  it("matches same origin scripts, styles, fonts and images", () => {
    const matches = createStaticAssetMatcher()

    for (const destination of [
      "script",
      "style",
      "font",
      "image",
    ] as const) {
      expect(matches(...assetRequest("/x", { destination }))).toBe(true)
    }
  })

  it("matches anything under /assets/ whatever its destination", () => {
    const matches = createStaticAssetMatcher()

    expect(matches(...assetRequest("/assets/board.json"))).toBe(true)
  })

  it("skips other destinations outside /assets/", () => {
    const matches = createStaticAssetMatcher()

    expect(matches(...assetRequest("/data.json"))).toBe(false)
  })

  it("skips other origins, non GET requests and navigations", () => {
    const matches = createStaticAssetMatcher()

    expect(
      matches(new URL("https://cdn.test/a.js"), {
        method: "GET",
        mode: "cors",
        destination: "script",
      } as Request),
    ).toBe(false)
    expect(
      matches(...assetRequest("/assets/a.js", { method: "POST" })),
    ).toBe(false)
    expect(
      matches(...assetRequest("/assets/a.js", { mode: "navigate" })),
    ).toBe(false)
  })

  it("skips /api/ and any extra excluded prefix", () => {
    const matches = createStaticAssetMatcher({
      excludePathPrefixes: ["/assets/private/"],
    })

    expect(
      matches(
        ...assetRequest("/api/avatar.png", { destination: "image" }),
      ),
    ).toBe(false)
    expect(matches(...assetRequest("/assets/private/a.js"))).toBe(false)
    expect(matches(...assetRequest("/assets/public/a.js"))).toBe(true)
  })
})
