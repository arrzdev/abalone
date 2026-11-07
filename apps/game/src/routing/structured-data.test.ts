import { describe, expect, it } from "vitest"
import type { Language } from "@/i18n/languages"
import { SUPPORTED_LANGUAGES } from "@/i18n/languages"
import { localePath } from "@/i18n/locale-path"
import type { IndexablePath } from "@/routing/seo-pages"
import { PAGE_LANGUAGES, seoPageHead } from "@/routing/seo-pages"

//the JSON-LD each indexable page carries (tech-seo-spec item 4 on TUD-626).
//search engines read it as a description of what is on the page, so it may only
//say what the page shows; e2e/structured-data.spec.ts checks that half against
//the served HTML

const ORIGIN = "https://abalone.tudu.dev"

type Json = Record<string, unknown>

function allStructuredData(
  path: IndexablePath,
  language?: Language,
): Json[] {
  const scripts = seoPageHead(path, language).scripts ?? []
  return scripts.map((script) => {
    expect(script.type).toBe("application/ld+json")
    return JSON.parse(script.children) as Json
  })
}

//what describes the page itself; the breadcrumb trail has its own tests below
function structuredData(path: IndexablePath): Json[] {
  return allStructuredData(path).filter(
    (block) => block["@type"] !== "BreadcrumbList",
  )
}

function breadcrumbs(path: IndexablePath, language?: Language): Json[] {
  return allStructuredData(path, language).filter(
    (block) => block["@type"] === "BreadcrumbList",
  )
}

function canonicalOf(path: IndexablePath, language?: Language): string {
  const link = seoPageHead(path, language).links.find(
    (entry) => entry.rel === "canonical",
  )
  return link?.href ?? ""
}

describe("structured data", () => {
  it("describes the home page as a free web game, with its FAQ", () => {
    const [game, faq, ...rest] = structuredData("/")
    expect(rest).toEqual([])
    expect(faq["@type"]).toBe("FAQPage")
    expect(
      (faq.mainEntity as Json[]).map((question) => question.name),
    ).toEqual([
      "Can I play Abalone online for free?",
      "Do I need an account to play Abalone?",
      "Can I play Abalone against the computer?",
      "Can two people play Abalone on one device?",
    ])
    expect(game).toEqual({
      "@context": "https://schema.org",
      "@type": "VideoGame",
      name: "Abalone",
      url: `${ORIGIN}/`,
      description:
        "Play the Abalone board game online for free: against the computer, a friend on one device, or an online opponent.",
      genre: "Board game",
      playMode: ["SinglePlayer", "MultiPlayer"],
      applicationCategory: "Game",
      operatingSystem: "Web",
      offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
    })
  })

  it("describes the rules as five steps, each pointing at its section", () => {
    const [howTo, faq, ...rest] = structuredData("/rules")
    expect(rest).toEqual([])
    expect(faq["@type"]).toBe("FAQPage")
    const questions = faq.mainEntity as Json[]
    expect(questions.map((question) => question.name)).toEqual([
      "Who goes first in Abalone?",
      "Can I move marbles diagonally?",
      "Can a single marble push?",
      "Can you push your own marbles?",
      "Can Abalone end in a draw?",
      "Can two people play Abalone on the same device?",
      "Can I play without an internet connection?",
    ])
    expect(questions[2]).toEqual({
      "@type": "Question",
      name: "Can a single marble push?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. A push needs at least two marbles against one.",
      },
    })
    expect(howTo["@context"]).toBe("https://schema.org")
    expect(howTo["@type"]).toBe("HowTo")
    expect(howTo.name).toBe("How to play Abalone")
    expect(howTo.url).toBe(`${ORIGIN}/rules`)

    const steps = howTo.step as Json[]
    expect(
      steps.map((step) => [step["@type"], step.name, step.url]),
    ).toEqual([
      ["HowToStep", "The goal", `${ORIGIN}/rules#goal`],
      ["HowToStep", "How marbles move", `${ORIGIN}/rules#directions`],
      [
        "HowToStep",
        "Moving one, two or three marbles",
        `${ORIGIN}/rules#moving-groups`,
      ],
      ["HowToStep", "Pushing: the sumito", `${ORIGIN}/rules#sumito`],
      [
        "HowToStep",
        "Pushing marbles off the board",
        `${ORIGIN}/rules#pushing-off`,
      ],
    ])
    for (const step of steps) {
      //plain text: the copy marks words up for the page, a search result does not
      expect(step.text).toEqual(expect.any(String))
      expect(step.text as string).not.toMatch(/<[^>]+>/)
      expect((step.text as string).length).toBeGreaterThan(20)
    }
    expect(steps[0].text).toBe(
      "Push six of your opponent's marbles off the edge of the board. The first player to do it wins. You cannot win by trapping marbles, only by pushing them out.",
    )
  })

  it("describes the strategy page as an article by TUDU, with its FAQ", () => {
    const [article, faq, ...rest] = structuredData("/strategy")
    expect(rest).toEqual([])
    expect(faq).toEqual({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "Is Abalone solved?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "No. Only very small versions of the board have been solved. The full board of 61 cells has no known perfect strategy, so the tips above still decide most games.",
          },
        },
        {
          "@type": "Question",
          name: "What is the best first move?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "It depends on the layout. See Abalone opening moves.",
          },
        },
        {
          "@type": "Question",
          name: "How many difficulty levels does the computer have?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Eight, from Gus at level 1 to Magnus at level 8. The first four have habits you can use against them. Levels 1 to 6 look one move ahead, Clara two and Magnus three.",
          },
        },
      ],
    })
    expect([article]).toEqual([
      {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: "Abalone strategy: 7 tips to win",
        description:
          "Seven Abalone strategy tips: control the center, keep groups of three, pick a safe opening and push at the right moment. Try them against the computer.",
        url: `${ORIGIN}/strategy`,
        mainEntityOfPage: `${ORIGIN}/strategy`,
        image: `${ORIGIN}/images/social/og-rules.jpg`,
        datePublished: "2026-10-11",
        author: { "@type": "Organization", name: "TUDU" },
        publisher: { "@type": "Organization", name: "TUDU" },
      },
    ])
  })

  it("describes the opening moves page as an article by TUDU", () => {
    expect(structuredData("/opening-moves")).toEqual([
      {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: "Abalone opening moves for beginners",
        description:
          "Abalone opening moves for beginners: the starting position, safe first moves, side steps and how the daisy layouts change the opening. Try them free.",
        url: `${ORIGIN}/opening-moves`,
        mainEntityOfPage: `${ORIGIN}/opening-moves`,
        image: `${ORIGIN}/images/social/og-rules.jpg`,
        datePublished: "2026-10-17",
        author: { "@type": "Organization", name: "TUDU" },
        publisher: { "@type": "Organization", name: "TUDU" },
      },
    ])
  })

  it("describes the starting positions page as an article with its FAQ", () => {
    const [article, faq, ...rest] = structuredData("/starting-positions")
    expect(rest).toEqual([])
    expect(article).toEqual({
      "@context": "https://schema.org",
      "@type": "Article",
      headline: "Abalone starting positions",
      description:
        "Abalone starting position explained: standard, Belgian daisy and German daisy side by side, how they differ and which to pick. Try each free.",
      url: `${ORIGIN}/starting-positions`,
      mainEntityOfPage: `${ORIGIN}/starting-positions`,
      image: `${ORIGIN}/images/social/og-rules.jpg`,
      datePublished: "2026-10-18",
      author: { "@type": "Organization", name: "TUDU" },
      publisher: { "@type": "Organization", name: "TUDU" },
    })
    expect(faq["@type"]).toBe("FAQPage")
    const questions = faq.mainEntity as Json[]
    expect(questions).toHaveLength(6)
    expect(questions[1]).toEqual({
      "@type": "Question",
      name: "Who moves first in Abalone?",
      acceptedAnswer: { "@type": "Answer", text: "Black moves first." },
    })
  })

  //the game screen is a tool, not a document: its setup panel shows options
  //only, so there is no FAQ to describe
  it("gives the offline game no structured data", () => {
    expect(structuredData("/offline")).toEqual([])
  })

  //the public landing for online play: the FAQ it shows, links taken out
  it("gives the play online page the FAQ it shows", () => {
    const [faq, ...rest] = structuredData("/play-online")
    expect(rest).toEqual([])
    expect(faq["@type"]).toBe("FAQPage")
    const questions = faq.mainEntity as Json[]
    expect(questions.map((question) => question.name)).toEqual([
      "Is online Abalone free?",
      "Do I need an account to play Abalone?",
      "How do I play Abalone online with a friend?",
      "Is the invite link private?",
      "Do we have to be online at the same time?",
      "Is there a game code?",
    ])
    expect(questions[1]).toEqual({
      "@type": "Question",
      name: "Do I need an account to play Abalone?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No, not to play the computer or to pass the device between two players. Those modes start instantly with no sign-up. You only need a free account to play a friend online, because online games and invites are tied to a username.",
      },
    })
  })

  it("describes /how-to-play as a HowTo of its five steps plus a FAQ", () => {
    const [howTo, faq] = structuredData("/how-to-play")

    expect(howTo["@type"]).toBe("HowTo")
    expect(howTo.url).toBe(`${ORIGIN}/how-to-play`)
    const steps = howTo.step as Json[]
    expect(steps.map((step) => step.url)).toEqual(
      ["setup", "move", "kinds", "push", "win"].map(
        (id) => `${ORIGIN}/how-to-play#${id}`,
      ),
    )
    for (const step of steps) {
      expect(step.text as string).not.toMatch(/<[^>]+>/)
    }
    expect(faq["@type"]).toBe("FAQPage")
    expect(faq.mainEntity).toHaveLength(4)
  })

  describe("breadcrumb trail", () => {
    const GUIDES = [
      "/rules",
      "/strategy",
      "/how-to-play",
      "/opening-moves",
      "/starting-positions",
    ] as const

    it("lists home then the page on each guide, with absolute URLs", () => {
      for (const path of GUIDES) {
        const trails = breadcrumbs(path)
        expect(trails, path).toHaveLength(1)
        const [trail] = trails
        expect(trail["@context"]).toBe("https://schema.org")
        const items = trail.itemListElement as Json[]
        expect(items, path).toHaveLength(2)
        expect(
          items.map((item) => item.position),
          path,
        ).toEqual([1, 2])
        for (const item of items) expect(item["@type"]).toBe("ListItem")
        expect(items[0].name).toBe("Abalone")
        expect(items[0].item).toBe(`${ORIGIN}/`)
        expect(items[1].item).toBe(`${ORIGIN}${path}`)
        expect(items[1].item).toBe(canonicalOf(path))
      }
    })

    it("names the page the way the site calls it", () => {
      const names = GUIDES.map((path) => {
        const [trail] = breadcrumbs(path)
        return (trail.itemListElement as Json[])[1].name
      })
      expect(names).toEqual([
        "Rules",
        "Strategy",
        "How to play",
        "Opening moves",
        "Starting positions",
      ])
    })

    it("is one script each in every language the guide is translated into", () => {
      for (const path of GUIDES) {
        for (const language of PAGE_LANGUAGES[path]) {
          const trails = breadcrumbs(path, language)
          expect(trails, `${language} ${path}`).toHaveLength(1)
          const items = trails[0].itemListElement as Json[]
          expect(items.map((item) => item.position)).toEqual([1, 2])
          expect(items[0].item).toBe(
            `${ORIGIN}${localePath("/", language)}`,
          )
          expect(items[1].item).toBe(canonicalOf(path, language))
          expect(items[1].item).toBe(
            `${ORIGIN}${localePath(path, language)}`,
          )
        }
      }
    })

    it("is written in the page's language", () => {
      const [pt] = breadcrumbs("/rules", "pt")
      const ptItems = pt.itemListElement as Json[]
      expect(ptItems[0]).toEqual({
        "@type": "ListItem",
        position: 1,
        name: "Abalone",
        item: `${ORIGIN}/pt`,
      })
      expect(ptItems[1]).toEqual({
        "@type": "ListItem",
        position: 2,
        name: "Regras",
        item: `${ORIGIN}/pt/rules`,
      })
      const [de] = breadcrumbs("/strategy", "de")
      expect((de.itemListElement as Json[])[1].name).toBe("Strategie")
    })

    //the other payloads quote English copy, so a translated page carries the
    //trail and nothing else
    it("is all a translated page carries", () => {
      expect(allStructuredData("/rules", "pt")).toHaveLength(1)
    })

    //a guide with no translation serves English at /pt/...: its trail is the
    //English page's, on the canonical it names
    it("follows the canonical of a guide that has no translation", () => {
      const [trail] = breadcrumbs("/opening-moves", "pt")
      const items = trail.itemListElement as Json[]
      expect(items[0].item).toBe(`${ORIGIN}/`)
      expect(items[1].item).toBe(`${ORIGIN}/opening-moves`)
      expect(canonicalOf("/opening-moves", "pt")).toBe(
        `${ORIGIN}/opening-moves`,
      )
    })

    it("is left off home, the game screen and the online landing", () => {
      for (const path of ["/", "/offline", "/play-online"] as const) {
        for (const language of SUPPORTED_LANGUAGES) {
          expect(
            breadcrumbs(path, language),
            `${language} ${path}`,
          ).toEqual([])
        }
      }
    })

    it("escapes < like the other scripts", () => {
      for (const language of PAGE_LANGUAGES["/rules"]) {
        for (const script of seoPageHead("/rules", language).scripts ??
          []) {
          expect(script.children).not.toContain("<")
        }
      }
    })
  })
})
