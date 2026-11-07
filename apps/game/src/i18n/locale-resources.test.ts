import type { ResourceKey } from "i18next"
import type { Mock } from "vitest"
import { describe, expect, it, vi } from "vitest"
import { createLocaleResources, NAMESPACES } from "@/i18n/locale-resources"

//a loader per file, each answering with a marker of which file it is
function loadersFor(languages: string[]) {
  const lazy: Record<string, Mock<() => Promise<ResourceKey>>> = {}
  for (const language of languages) {
    for (const namespace of NAMESPACES) {
      lazy[`./locales/${language}/${namespace}.json`] = vi
        .fn<() => Promise<ResourceKey>>()
        .mockResolvedValue({ from: `${language}/${namespace}` })
    }
  }
  return lazy
}

describe("createLocaleResources", () => {
  it("holds nothing it was not given or asked for", () => {
    const resources = createLocaleResources({
      eager: {},
      lazy: loadersFor(["de"]),
    })

    expect(resources.resource("de", "common")).toBeUndefined()
    expect(resources.isLoaded("de")).toBe(false)
  })

  it("fetches the five files of a language and no other language's", async () => {
    const lazy = loadersFor(["de", "ja"])
    const resources = createLocaleResources({ eager: {}, lazy })

    await resources.load("de")

    expect(resources.isLoaded("de")).toBe(true)
    expect(resources.resource("de", "game")).toEqual({ from: "de/game" })
    expect(resources.isLoaded("ja")).toBe(false)
    expect(lazy["./locales/ja/common.json"]).not.toHaveBeenCalled()
  })

  it("fetches a language once however often, or at once, it is asked for", async () => {
    const lazy = loadersFor(["de"])
    const resources = createLocaleResources({ eager: {}, lazy })

    await Promise.all([resources.load("de"), resources.load("de")])
    await resources.load("de")

    expect(lazy["./locales/de/common.json"]).toHaveBeenCalledTimes(1)
  })

  it("does not fetch what it already holds", async () => {
    const lazy = loadersFor(["en"])
    const eager = Object.fromEntries(
      NAMESPACES.map((namespace) => [
        `./locales/en/${namespace}.json`,
        { held: namespace },
      ]),
    )
    const resources = createLocaleResources({ eager, lazy })

    expect(resources.isLoaded("en")).toBe(true)
    await resources.load("en")

    expect(resources.resource("en", "online")).toEqual({ held: "online" })
    expect(lazy["./locales/en/online.json"]).not.toHaveBeenCalled()
  })

  it("tries again after a fetch failed", async () => {
    const lazy = loadersFor(["fr"])
    lazy["./locales/fr/common.json"]
      ?.mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue({ from: "fr/common" })
    const resources = createLocaleResources({ eager: {}, lazy })

    await expect(resources.load("fr")).rejects.toThrow("offline")
    expect(resources.isLoaded("fr")).toBe(false)

    await resources.load("fr")

    expect(resources.isLoaded("fr")).toBe(true)
  })
})
