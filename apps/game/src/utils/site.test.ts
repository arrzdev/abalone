import { describe, expect, it } from "vitest"
import { SITE_ORIGIN, siteUrl } from "@/utils/site"

describe("siteUrl", () => {
  it("makes an app path absolute on the one origin", () => {
    expect(siteUrl("/rules")).toBe(`${SITE_ORIGIN}/rules`)
    expect(siteUrl("/images/social/og-home.jpg")).toBe(
      "https://abalone.tudu.dev/images/social/og-home.jpg",
    )
  })

  it("keeps the root as the bare origin plus a slash", () => {
    expect(siteUrl("/")).toBe("https://abalone.tudu.dev/")
  })

  it("has no trailing slash on the origin, so paths do not double it", () => {
    expect(SITE_ORIGIN.endsWith("/")).toBe(false)
  })
})
