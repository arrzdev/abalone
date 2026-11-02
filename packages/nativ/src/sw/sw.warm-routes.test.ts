import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  createInstallRouteWarmer,
  registerInstallRouteWarmer,
} from "#nativ/sw/sw.warm-routes"

const ORIGIN = "https://app.test"

let cache: { put: ReturnType<typeof vi.fn> }
let openCache: ReturnType<typeof vi.fn>
let installListener: ((event: unknown) => void) | undefined

beforeEach(() => {
  cache = { put: vi.fn(async () => {}) }
  openCache = vi.fn(async () => cache)
  installListener = undefined
  vi.stubGlobal("self", {
    location: { origin: ORIGIN },
    addEventListener: (
      type: string,
      listener: (event: unknown) => void,
    ) => {
      if (type === "install") installListener = listener
    },
  })
  vi.stubGlobal("caches", { open: openCache })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function cachedUrls() {
  return cache.put.mock.calls.map(([request]) => (request as Request).url)
}

describe("createInstallRouteWarmer", () => {
  it("caches each distinct route once in the pages bucket", async () => {
    const fetchDocument = vi.fn(async () => new Response("<html>"))
    vi.stubGlobal("fetch", fetchDocument)

    await createInstallRouteWarmer({
      buildTag: "v1",
      routes: ["/", "/rules", "/rules"],
    })()

    expect(openCache).toHaveBeenCalledWith("pages-v1")
    expect(fetchDocument).toHaveBeenCalledTimes(2)
    expect(cachedUrls()).toEqual([`${ORIGIN}/`, `${ORIGIN}/rules`])
  })

  it("asks for an HTML document with same origin credentials", async () => {
    const fetchDocument = vi.fn(
      async (_request: Request) => new Response(""),
    )
    vi.stubGlobal("fetch", fetchDocument)

    await createInstallRouteWarmer({ buildTag: "v1", routes: ["/"] })()

    const request = fetchDocument.mock.calls[0]?.[0]
    expect(request?.method).toBe("GET")
    expect(request?.credentials).toBe("same-origin")
    expect(request?.headers.get("Accept")).toMatch(/^text\/html/)
  })

  it("skips failed responses and offline errors without failing install", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (request: Request) => {
        if (request.url.endsWith("/missing")) {
          return new Response("", { status: 404 })
        }
        if (request.url.endsWith("/offline"))
          throw new TypeError("offline")
        return new Response("<html>")
      }),
    )

    await createInstallRouteWarmer({
      buildTag: "v1",
      cacheBucket: "docs",
      routes: ["/missing", "/offline", "/ok"],
    })()

    expect(openCache).toHaveBeenCalledWith("docs-v1")
    expect(cachedUrls()).toEqual([`${ORIGIN}/ok`])
  })
})

describe("registerInstallRouteWarmer", () => {
  it("holds install until the routes are warmed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("<html>")),
    )
    registerInstallRouteWarmer({ buildTag: "v1", routes: ["/"] })
    const waitUntil = vi.fn()

    installListener?.({ waitUntil })

    expect(waitUntil).toHaveBeenCalledOnce()
    await waitUntil.mock.calls[0]?.[0]
    expect(cachedUrls()).toEqual([`${ORIGIN}/`])
  })
})
