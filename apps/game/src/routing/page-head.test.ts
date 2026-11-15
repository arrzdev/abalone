import { describe, expect, it } from "vitest"
import { pageHead } from "@/routing/page-head"

type Head = ReturnType<typeof pageHead>

function meta(head: Head, key: string): string | undefined {
  return head.meta.find(
    (entry) => entry.name === key || entry.property === key,
  )?.content
}

const base = {
  title: "Rules",
  description: "How to play.",
  path: "/rules",
}

describe("pageHead", () => {
  it("appends the brand to the page's name", () => {
    const head = pageHead(base)

    expect(head.meta[0]).toEqual({ title: "Rules · Abalone" })
    expect(meta(head, "og:title")).toBe("Rules · Abalone")
    expect(meta(head, "twitter:title")).toBe("Rules · Abalone")
  })

  it("shows a full title as written", () => {
    const head = pageHead({
      ...base,
      title: "Abalone rules",
      fullTitle: true,
    })

    expect(head.meta[0]).toEqual({ title: "Abalone rules" })
  })

  it("writes absolute urls, because a card renderer resolves nothing", () => {
    const head = pageHead(base)

    expect(meta(head, "og:url")).toBe("https://abalone.tudu.dev/rules")
    expect(meta(head, "og:image")).toBe(
      "https://abalone.tudu.dev/images/social/og-home.jpg",
    )
    expect(head.links).toEqual([
      { rel: "canonical", href: "https://abalone.tudu.dev/rules" },
    ])
  })

  it("picks the card picture by name", () => {
    const head = pageHead({ ...base, image: "rules" })

    expect(meta(head, "og:image")).toMatch(/og-rules\.jpg$/)
    expect(meta(head, "twitter:image")).toMatch(/og-rules\.jpg$/)
  })

  it("puts the canonical and og:url in the page's language", () => {
    const head = pageHead({ ...base, language: "pt" })

    expect(meta(head, "og:url")).toBe("https://abalone.tudu.dev/pt/rules")
    expect(head.links[0]?.href).toBe("https://abalone.tudu.dev/pt/rules")
  })

  it("keeps the home page's url a bare language prefix", () => {
    const head = pageHead({ ...base, path: "/", language: "de" })

    expect(meta(head, "og:url")).toBe("https://abalone.tudu.dev/de")
  })

  it("lists every alternate, then x-default on the english url", () => {
    const head = pageHead({ ...base, alternates: ["en", "pt"] })

    expect(head.links.slice(1)).toEqual([
      {
        rel: "alternate",
        hrefLang: "en",
        href: "https://abalone.tudu.dev/rules",
      },
      {
        rel: "alternate",
        hrefLang: "pt",
        href: "https://abalone.tudu.dev/pt/rules",
      },
      {
        rel: "alternate",
        hrefLang: "x-default",
        href: "https://abalone.tudu.dev/rules",
      },
    ])
  })

  it("writes no alternates unless asked to", () => {
    expect(pageHead(base).links.some((l) => l.rel === "alternate")).toBe(
      false,
    )
  })

  it("keeps a page out of search results only when asked", () => {
    expect(meta(pageHead(base), "robots")).toBeUndefined()
    expect(meta(pageHead({ ...base, noIndex: true }), "robots")).toBe(
      "noindex",
    )
  })
})
