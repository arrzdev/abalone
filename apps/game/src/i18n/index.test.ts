import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

//the language is picked once, when the module loads, so each test loads a
//fresh copy after arranging what the visitor's browser says.
async function loadI18n() {
  vi.resetModules()
  return import("@/i18n")
}

describe("<html lang>", () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.lang = "en"
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("is the browser's language when the visitor never picked one", async () => {
    vi.stubGlobal("navigator", { ...navigator, language: "ja-JP" })

    await loadI18n()

    expect(document.documentElement.lang).toBe("ja")
  })

  it("is the stored language on a return visit", async () => {
    localStorage.setItem("abalone_language", "es")

    await loadI18n()

    expect(document.documentElement.lang).toBe("es")
  })

  it("follows a switch made from the settings sheet", async () => {
    const { changeLanguage } = await loadI18n()

    changeLanguage("zh")

    expect(document.documentElement.lang).toBe("zh")
  })
})
