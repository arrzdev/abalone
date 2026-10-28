import { describe, expect, it } from "vitest"
import type { Language } from "@/i18n/languages"
import { SUPPORTED_LANGUAGES } from "@/i18n/languages"
import type { IndexablePath } from "@/routing/seo-pages"
import {
  PAGE_LANGUAGES,
  SEO_PAGES,
  seoCopy,
  seoPageHead,
} from "@/routing/seo-pages"

//every locale file, read the way vite bundles them
const LOCALES = import.meta.glob<Record<string, unknown>>(
  "../i18n/locales/*/*.json",
  { eager: true, import: "default" },
)

//where each page's body copy lives. a page is a page of its own in a language
//only when this section is translated; otherwise its text falls back to english
const BODY_COPY: Record<IndexablePath, [namespace: string, key: string]> =
  {
    "/": ["common", "home"],
    "/rules": ["game", "rules"],
    "/strategy": ["game", "strategy"],
    "/offline": ["game", "offline"],
    "/opening-moves": ["game", "openings"],
    "/starting-positions": ["game", "positions"],
    "/play-online": ["game", "playOnline"],
  }

function hasBodyCopy(path: IndexablePath, language: Language): boolean {
  const [namespace, key] = BODY_COPY[path]
  const file = LOCALES[`../i18n/locales/${language}/${namespace}.json`]
  return file !== undefined && key in file
}

const PATHS = Object.keys(SEO_PAGES) as IndexablePath[]
const ORIGIN = "https://abalone.tudu.dev"

type Head = ReturnType<typeof seoPageHead>
type HeadLink = Head["links"][number] & { hrefLang?: string }

function metaContent(head: Head, key: string): string | undefined {
  const tag = head.meta.find(
    (entry) => entry.name === key || entry.property === key,
  )
  return (
    tag?.content ?? (key === "title" ? head.meta[0]?.title : undefined)
  )
}

function canonical(head: Head): string | undefined {
  return head.links.find((link) => link.rel === "canonical")?.href
}

function alternates(head: Head): Record<string, string> {
  return Object.fromEntries(
    (head.links as HeadLink[])
      .filter((link) => link.rel === "alternate" && link.hrefLang)
      .map((link) => [link.hrefLang, link.href]),
  )
}

describe("PAGE_LANGUAGES", () => {
  it.each(PATHS)(
    "lists %s in exactly the languages its copy is in",
    (path) => {
      const translated = SUPPORTED_LANGUAGES.filter((language) =>
        hasBodyCopy(path, language),
      )
      expect([...PAGE_LANGUAGES[path]].sort()).toEqual(
        [...translated].sort(),
      )
    },
  )

  it("always has english, the x-default", () => {
    for (const path of PATHS) expect(PAGE_LANGUAGES[path]).toContain("en")
  })
})

describe("seoCopy", () => {
  const localized = PATHS.flatMap((path) =>
    PAGE_LANGUAGES[path]
      .filter((language) => language !== "en")
      .map((language) => [path, language] as const),
  )

  it("has at least the pages translated today in another language", () => {
    expect(localized.length).toBeGreaterThan(0)
  })

  it.each(localized)(
    "%s in %s is its own title and description",
    (path, language) => {
      const english = SEO_PAGES[path]
      const copy = seoCopy(path, language)

      expect(copy.title).not.toBe(english.title)
      expect(copy.description).not.toBe(english.description)
      expect(copy.title).toContain("Abalone")
      expect(copy.title.length).toBeLessThanOrEqual(60)
      expect(copy.description.length).toBeLessThanOrEqual(155)
      expect(copy.image).toBe(english.image)
    },
  )

  it("is english for a language the page is not in", () => {
    expect(seoCopy("/opening-moves", "pt")).toEqual(
      SEO_PAGES["/opening-moves"],
    )
  })
})

describe("seoPageHead in a language", () => {
  it("is the page's own copy, on its own url", () => {
    const head = seoPageHead("/rules", "pt")
    const copy = seoCopy("/rules", "pt")

    expect(metaContent(head, "title")).toBe(copy.title)
    expect(metaContent(head, "description")).toBe(copy.description)
    expect(metaContent(head, "og:title")).toBe(copy.title)
    expect(metaContent(head, "og:url")).toBe(`${ORIGIN}/pt/rules`)
    expect(canonical(head)).toBe(`${ORIGIN}/pt/rules`)
  })

  it("names every language version and english as x-default", () => {
    const expected = Object.fromEntries([
      ...SUPPORTED_LANGUAGES.map((language) => [
        language,
        language === "en"
          ? `${ORIGIN}/rules`
          : `${ORIGIN}/${language}/rules`,
      ]),
      ["x-default", `${ORIGIN}/rules`],
    ])

    expect(alternates(seoPageHead("/rules", "pt"))).toEqual(expected)
    expect(alternates(seoPageHead("/rules", "en"))).toEqual(expected)
  })

  it("writes a language's home as the bare prefix", () => {
    const head = seoPageHead("/", "ja")
    expect(canonical(head)).toBe(`${ORIGIN}/ja`)
    expect(alternates(head)["x-default"]).toBe(`${ORIGIN}/`)
  })

  it("points an untranslated page at the english one", () => {
    const head = seoPageHead("/opening-moves", "pt")

    expect(canonical(head)).toBe(`${ORIGIN}/opening-moves`)
    expect(alternates(head)).toEqual({
      en: `${ORIGIN}/opening-moves`,
      "x-default": `${ORIGIN}/opening-moves`,
    })
  })
})
