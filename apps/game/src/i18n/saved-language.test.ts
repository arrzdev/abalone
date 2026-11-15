import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  browserLanguages,
  clientLocaleRedirect,
  savedLanguage,
  saveLanguage,
} from "@/i18n/saved-language"
import { stubMemoryStorage } from "@/test-support/memory-storage"

//the language the player picked, as a cookie the Worker can read, and the
//client's repeat of the Worker's redirect for navigations the service worker
//answered on its own

function clearCookie() {
  //biome-ignore lint/suspicious/noDocumentCookie: no Cookie Store API in happy-dom
  document.cookie = "abalone_language=; Max-Age=0; Path=/"
}

function stubLocation(location: Partial<Location>) {
  vi.stubGlobal("location", { ...window.location, ...location })
  //the module reads `window.location`, which is not `globalThis.location`
  //in every environment, so both are pointed at the same stand-in
  vi.stubGlobal(
    "window",
    Object.assign(window, { location: globalThis.location }),
  )
}

describe("savedLanguage", () => {
  beforeEach(() => {
    clearCookie()
    stubMemoryStorage()
  })

  afterEach(() => {
    clearCookie()
    vi.unstubAllGlobals()
  })

  it("is null when nothing was ever saved", () => {
    expect(savedLanguage()).toBeNull()
  })

  it("is the language in the cookie", () => {
    saveLanguage("pt")
    expect(savedLanguage()).toBe("pt")
  })

  it("ignores a cookie naming a language the game does not ship", () => {
    //biome-ignore lint/suspicious/noDocumentCookie: seeding the fixture
    document.cookie = "abalone_language=sv; Path=/"
    expect(savedLanguage()).toBeNull()
  })

  it("falls back to the old localStorage key", () => {
    localStorage.setItem("abalone_language", "ja")
    expect(savedLanguage()).toBe("ja")
  })

  it("prefers the cookie over the old key", () => {
    localStorage.setItem("abalone_language", "ja")
    saveLanguage("de")
    expect(savedLanguage()).toBe("de")
  })

  it("ignores an old key naming an unsupported language", () => {
    localStorage.setItem("abalone_language", "sv")
    expect(savedLanguage()).toBeNull()
  })

  it("is null when storage throws, as in private mode", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("denied")
      },
    })
    expect(savedLanguage()).toBeNull()
  })
})

describe("saveLanguage", () => {
  afterEach(() => {
    clearCookie()
    vi.restoreAllMocks()
  })

  it("writes a year-long, site-wide, lax cookie", () => {
    const write = vi.spyOn(document, "cookie", "set")

    saveLanguage("es")

    expect(write).toHaveBeenCalledWith(
      "abalone_language=es; Max-Age=31536000; Path=/; SameSite=Lax",
    )
  })
})

describe("browserLanguages", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("joins the browser's languages, best first", () => {
    vi.stubGlobal("navigator", {
      languages: ["pt-BR", "en"],
      language: "x",
    })
    expect(browserLanguages()).toBe("pt-BR,en")
  })

  it("uses the single language when there is no list", () => {
    vi.stubGlobal("navigator", { languages: [], language: "ja-JP" })
    expect(browserLanguages()).toBe("ja-JP")
  })

  it("is null when the browser says nothing", () => {
    vi.stubGlobal("navigator", { languages: [], language: "" })
    expect(browserLanguages()).toBeNull()
  })
})

describe("clientLocaleRedirect", () => {
  beforeEach(() => {
    clearCookie()
    stubMemoryStorage()
    stubLocation({ pathname: "/rules", search: "", hash: "" })
  })

  afterEach(() => {
    clearCookie()
    vi.unstubAllGlobals()
  })

  it("sends an unprefixed page to the saved language", () => {
    vi.stubGlobal("navigator", { languages: ["en"], language: "en" })
    saveLanguage("pt")
    expect(clientLocaleRedirect()).toBe("/pt/rules")
  })

  it("keeps the query and the hash on the way", () => {
    vi.stubGlobal("navigator", { languages: ["en"], language: "en" })
    saveLanguage("pt")
    stubLocation({ pathname: "/rules", search: "?a=1", hash: "#sumito" })
    expect(clientLocaleRedirect()).toBe("/pt/rules?a=1#sumito")
  })

  it("follows the browser's language when nothing was saved", () => {
    vi.stubGlobal("navigator", { languages: ["de-DE"], language: "de-DE" })
    expect(clientLocaleRedirect()).toBe("/de/rules")
  })

  it("is null when the address is already right", () => {
    vi.stubGlobal("navigator", { languages: ["en"], language: "en" })
    expect(clientLocaleRedirect()).toBeNull()
  })

  it("is null on a prefixed address, whatever was saved", () => {
    vi.stubGlobal("navigator", { languages: ["en"], language: "en" })
    saveLanguage("de")
    stubLocation({ pathname: "/pt/rules", search: "", hash: "" })
    expect(clientLocaleRedirect()).toBeNull()
  })
})
