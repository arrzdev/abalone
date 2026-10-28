import { describe, expect, it } from "vitest"
import {
  localePath,
  localeRedirect,
  pickLanguage,
  splitLocalePath,
} from "@/i18n/locale-path"

describe("localePath", () => {
  it("leaves english on the paths it always had", () => {
    expect(localePath("/", "en")).toBe("/")
    expect(localePath("/rules", "en")).toBe("/rules")
  })

  it("puts every other language under its code", () => {
    expect(localePath("/rules", "pt")).toBe("/pt/rules")
    expect(localePath("/online/abc", "ja")).toBe("/ja/online/abc")
  })

  it("writes a language's home as the bare prefix", () => {
    expect(localePath("/", "pt")).toBe("/pt")
  })
})

describe("splitLocalePath", () => {
  it("reads the language off a prefixed path", () => {
    expect(splitLocalePath("/pt/rules")).toEqual({
      language: "pt",
      path: "/rules",
      prefixed: true,
    })
  })

  it("reads a language's home with or without the trailing slash", () => {
    const home = { language: "pt", path: "/", prefixed: true }
    expect(splitLocalePath("/pt")).toEqual(home)
    expect(splitLocalePath("/pt/")).toEqual(home)
  })

  it("reads an unprefixed path as english", () => {
    expect(splitLocalePath("/rules")).toEqual({
      language: "en",
      path: "/rules",
      prefixed: false,
    })
  })

  it("marks /en as prefixed, so it can be moved off", () => {
    expect(splitLocalePath("/en/rules")).toEqual({
      language: "en",
      path: "/rules",
      prefixed: true,
    })
  })

  it("takes only a whole segment that is a language we ship", () => {
    expect(splitLocalePath("/portugal")).toEqual({
      language: "en",
      path: "/portugal",
      prefixed: false,
    })
    expect(splitLocalePath("/xx/rules")).toEqual({
      language: "en",
      path: "/xx/rules",
      prefixed: false,
    })
  })
})

describe("pickLanguage", () => {
  it("prefers the saved choice over the browser", () => {
    expect(
      pickLanguage({ cookie: "es", acceptLanguage: "pt-PT,pt" }),
    ).toBe("es")
    expect(
      pickLanguage({ cookie: "en", acceptLanguage: "pt-PT,pt" }),
    ).toBe("en")
  })

  it("ignores a saved value we do not ship", () => {
    expect(
      pickLanguage({ cookie: "xx", acceptLanguage: "pt-BR,pt;q=0.9" }),
    ).toBe("pt")
  })

  it("takes the browser language with the highest q we ship", () => {
    expect(
      pickLanguage({ cookie: null, acceptLanguage: "fr;q=0.4, de;q=0.8" }),
    ).toBe("de")
    expect(
      pickLanguage({ cookie: null, acceptLanguage: "sv, pt;q=0.5" }),
    ).toBe("pt")
  })

  it("is english when nothing says otherwise", () => {
    expect(pickLanguage({ cookie: null, acceptLanguage: null })).toBe("en")
    expect(pickLanguage({ cookie: null, acceptLanguage: "sv" })).toBe("en")
  })
})

describe("localeRedirect", () => {
  const visit = (
    pathname: string,
    visitor: { cookie?: string; acceptLanguage?: string; search?: string },
  ) =>
    localeRedirect({
      pathname,
      search: visitor.search ?? "",
      cookie: visitor.cookie ?? null,
      acceptLanguage: visitor.acceptLanguage ?? null,
    })

  it("sends an unprefixed visit to the browser's language", () => {
    expect(visit("/rules", { acceptLanguage: "pt-PT,pt;q=0.9" })).toEqual({
      location: "/pt/rules",
      status: 302,
    })
    expect(visit("/", { acceptLanguage: "pt-PT" })).toEqual({
      location: "/pt",
      status: 302,
    })
  })

  it("keeps the query string", () => {
    expect(
      visit("/rules", { acceptLanguage: "ja", search: "?from=share" }),
    ).toEqual({ location: "/ja/rules?from=share", status: 302 })
  })

  it("serves english where it is, for crawlers and english browsers", () => {
    expect(visit("/rules", {})).toBeNull()
    expect(visit("/rules", { acceptLanguage: "en-GB,en" })).toBeNull()
  })

  it("lets the saved choice override the browser", () => {
    expect(
      visit("/rules", { cookie: "en", acceptLanguage: "pt-PT" }),
    ).toBeNull()
    expect(visit("/rules", { cookie: "es" })).toEqual({
      location: "/es/rules",
      status: 302,
    })
  })

  it("never moves a prefixed url to another language", () => {
    expect(
      visit("/pt/rules", { cookie: "es", acceptLanguage: "de" }),
    ).toBeNull()
  })

  it("moves /en for good to the unprefixed path", () => {
    expect(visit("/en/rules", {})).toEqual({
      location: "/rules",
      status: 301,
    })
    expect(visit("/en", {})).toEqual({ location: "/", status: 301 })
  })

  it("leaves files and the api alone", () => {
    for (const path of ["/sitemap.xml", "/images/social/og-home.jpg"]) {
      expect(visit(path, { acceptLanguage: "pt" })).toBeNull()
    }
    expect(visit("/api/v1/health", { acceptLanguage: "pt" })).toBeNull()
  })
})
