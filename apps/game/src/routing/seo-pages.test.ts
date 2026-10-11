import { afterEach, describe, expect, it, vi } from "vitest"
import { pageHead } from "@/routing/page-head"
import { SEO_PAGES, seoPageHead } from "@/routing/seo-pages"

//the copy every indexable page ships with, word for word from the `page-copy`
//document on TUD-626. a search result quotes these, so a test pins them rather
//than trusting a later edit to keep them in step
const EXPECTED_COPY = {
  "/": {
    title: "Abalone: play the board game online, free",
    description:
      "Play Abalone free online. Challenge the computer, share a screen with a friend or invite someone to a live game. No download, no sign-up needed to start.",
  },
  "/rules": {
    title: "Abalone rules: how to play, moves, sumito and winning",
    description:
      "Learn the Abalone rules in minutes: how marbles move, how a sumito push works, how to win, plus the standard and daisy starting positions.",
  },
  "/strategy": {
    title: "Abalone strategy: 7 tips to win more games",
    description:
      "Seven Abalone strategy tips: control the center, keep groups of three, pick a safe opening and push at the right moment. Try them against the computer.",
  },
  "/offline": {
    title: "Play Abalone vs the computer or a friend on one device",
    description:
      "Play Abalone against the computer or pass the device to a friend. Pick the standard layout or a daisy opening and start a free game in your browser.",
  },
} as const

type Head = ReturnType<typeof pageHead>

function metaContent(head: Head, key: string): string | undefined {
  const tag = head.meta.find(
    (entry) => entry.name === key || entry.property === key,
  )
  return tag?.content
}

function titleOf(head: Head): string | undefined {
  return head.meta.find((entry) => "title" in entry)?.title
}

function canonicalOf(head: Head): string | undefined {
  return head.links?.find((link) => link.rel === "canonical")?.href
}

describe("SEO_PAGES", () => {
  it("lists exactly the pages search engines should index", () => {
    expect(Object.keys(SEO_PAGES).sort()).toEqual(
      Object.keys(EXPECTED_COPY).sort(),
    )
  })

  //google cuts a title at about 60 characters and a description at about 155;
  //past that the result shows an ellipsis where the point was
  it.each(Object.keys(EXPECTED_COPY))(
    "%s fits a search result without being cut",
    (path) => {
      const page = SEO_PAGES[path as keyof typeof SEO_PAGES]
      expect(page.title.length).toBeLessThanOrEqual(60)
      expect(page.description.length).toBeLessThanOrEqual(155)
    },
  )
})

describe("seoPageHead", () => {
  it.each(Object.entries(EXPECTED_COPY))(
    "%s carries its own copy, with no brand appended",
    (path, copy) => {
      const head = seoPageHead(path as keyof typeof SEO_PAGES)

      expect(titleOf(head)).toBe(copy.title)
      expect(metaContent(head, "og:title")).toBe(copy.title)
      expect(metaContent(head, "description")).toBe(copy.description)
      expect(metaContent(head, "og:description")).toBe(copy.description)
    },
  )

  it.each(Object.keys(EXPECTED_COPY))(
    "%s names itself on the canonical host, and og:url agrees",
    (path) => {
      const head = seoPageHead(path as keyof typeof SEO_PAGES)
      const expected = `https://abalone.tudu.dev${path}`

      expect(canonicalOf(head)).toBe(expected)
      expect(metaContent(head, "og:url")).toBe(expected)
      expect(metaContent(head, "robots")).toBeUndefined()
    },
  )
})

describe("pageHead", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  //the babaluje host serves the same game under a joke name; it is not a second
  //site, so a page read there still points search engines at abalone
  it("keeps the canonical on abalone when the page is served from babaluje", () => {
    vi.stubGlobal(
      "location",
      new URL("https://babaluje.tudu.dev/rules?ref=x"),
    )

    const head = seoPageHead("/rules")

    expect(canonicalOf(head)).toBe("https://abalone.tudu.dev/rules")
    expect(metaContent(head, "og:url")).toBe(
      "https://abalone.tudu.dev/rules",
    )
  })

  it("keeps a private page out of the index and still names its canonical", () => {
    const head = pageHead({
      title: "Profile",
      description: "Your account.",
      path: "/profile",
      noIndex: true,
    })

    expect(metaContent(head, "robots")).toBe("noindex")
    expect(canonicalOf(head)).toBe("https://abalone.tudu.dev/profile")
  })

  //pages that are not search entries keep the short name the tab bar has
  //always shown
  it("still appends the brand to a page that is not in SEO_PAGES", () => {
    const head = pageHead({
      title: "Profile",
      description: "Your account.",
      path: "/profile",
      noIndex: true,
    })

    expect(titleOf(head)).toBe("Profile · Abalone")
  })
})
