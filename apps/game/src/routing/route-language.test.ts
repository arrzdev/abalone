import { describe, expect, it } from "vitest"
import { routeLanguage } from "@/routing/route-language"

describe("routeLanguage", () => {
  it("is the language the router wrote into its context", () => {
    expect(routeLanguage({ language: "pt" })).toBe("pt")
    expect(routeLanguage({ language: "ja" })).toBe("ja")
  })

  it("is English when the context names no language", () => {
    expect(routeLanguage({})).toBe("en")
  })

  it("is English for a language the game does not ship", () => {
    expect(routeLanguage({ language: "sv" })).toBe("en")
    expect(routeLanguage({ language: "" })).toBe("en")
  })

  it("ignores everything else in the context", () => {
    expect(routeLanguage({ queryClient: {}, language: "de" })).toBe("de")
  })
})
