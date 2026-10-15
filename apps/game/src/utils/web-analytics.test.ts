import { afterEach, describe, expect, it } from "vitest"
import { startWebAnalytics } from "@/utils/web-analytics"

const BEACON_SRC = "https://static.cloudflareinsights.com/beacon.min.js"

//a web analytics site token. public by design: it ships in every page
const TOKEN = "0123456789abcdef0123456789abcdef"

const player = { webdriver: false }
const automated = { webdriver: true }

function beacons(): HTMLScriptElement[] {
  return [
    ...document.querySelectorAll<HTMLScriptElement>("script"),
  ].filter((script) => script.src === BEACON_SRC)
}

afterEach(() => {
  for (const script of beacons()) script.remove()
})

describe("startWebAnalytics", () => {
  it("adds the cloudflare beacon with the site token", () => {
    startWebAnalytics(TOKEN, document, player)

    const [beacon, ...others] = beacons()
    expect(others).toHaveLength(0)
    expect(beacon?.parentElement).toBe(document.head)
    expect(beacon?.defer).toBe(true)
  })

  //the beacon is told the token and nothing else: no user, no game, no page
  it("tells the beacon only the token", () => {
    startWebAnalytics(TOKEN, document, player)

    const config = beacons()[0]?.getAttribute("data-cf-beacon")
    expect(JSON.parse(config ?? "null")).toEqual({ token: TOKEN })
  })

  it("adds it once, however often it is called", () => {
    startWebAnalytics(TOKEN, document, player)
    startWebAnalytics(TOKEN, document, player)

    expect(beacons()).toHaveLength(1)
  })

  //dev, the e2e build and ci builds have no token
  it.each([
    ["no token", undefined],
    ["an empty token", ""],
    ["a blank token", "  "],
  ])("adds nothing with %s", (_label, token) => {
    startWebAnalytics(token, document, player)

    expect(beacons()).toHaveLength(0)
  })

  //our e2e and smoke checks are not visitors, the same rule as game events
  it("adds nothing when a test drives the browser", () => {
    startWebAnalytics(TOKEN, document, automated)

    expect(beacons()).toHaveLength(0)
  })
})
