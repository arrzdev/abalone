import { describe, expect, it } from "vitest"
import { SUPPORTED_LANGUAGES } from "@/i18n/languages"
import { documentLanguage, PAGE_LANGUAGES } from "@/routing/page-languages"
import type { IndexablePath } from "@/routing/seo-pages"

const PATHS = Object.keys(PAGE_LANGUAGES) as IndexablePath[]

describe("documentLanguage", () => {
  it("is the URL's language for every page translated into it", () => {
    for (const path of PATHS) {
      for (const language of PAGE_LANGUAGES[path]) {
        expect(
          documentLanguage(path, language),
          `${language}${path}`,
        ).toBe(language)
      }
    }
  })

  it("is English for a page that is not translated into the URL's language", () => {
    for (const path of PATHS) {
      for (const language of SUPPORTED_LANGUAGES) {
        if (PAGE_LANGUAGES[path].includes(language)) continue
        expect(
          documentLanguage(path, language),
          `${language}${path}`,
        ).toBe("en")
      }
    }
    expect(documentLanguage("/how-to-play", "de")).toBe("en")
    expect(documentLanguage("/opening-moves", "tr")).toBe("en")
  })

  it("reads a trailing slash as the same page", () => {
    expect(documentLanguage("/play-online/", "pt")).toBe("en")
    expect(documentLanguage("/opening-moves/", "de")).toBe("de")
  })

  it("keeps the URL's language for a path that is no indexable page", () => {
    expect(documentLanguage("/online", "pt")).toBe("pt")
    expect(documentLanguage("/invite/abc", "ja")).toBe("ja")
    expect(documentLanguage("/", "ko")).toBe("ko")
  })
})
