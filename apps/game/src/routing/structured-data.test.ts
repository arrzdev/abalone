import { describe, expect, it } from "vitest"
import type { IndexablePath } from "@/routing/seo-pages"
import { seoPageHead } from "@/routing/seo-pages"

//the JSON-LD each indexable page carries (tech-seo-spec item 4 on TUD-626).
//search engines read it as a description of what is on the page, so it may only
//say what the page shows; e2e/structured-data.spec.ts checks that half against
//the served HTML

const ORIGIN = "https://abalone.tudu.dev"

type Json = Record<string, unknown>

function structuredData(path: IndexablePath): Json[] {
  const scripts = seoPageHead(path).scripts ?? []
  return scripts.map((script) => {
    expect(script.type).toBe("application/ld+json")
    return JSON.parse(script.children) as Json
  })
}

describe("structured data", () => {
  it("describes the home page as a free web game", () => {
    expect(structuredData("/")).toEqual([
      {
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
      },
    ])
  })

  it("describes the rules as five steps, each pointing at its section", () => {
    const [howTo, faq, ...rest] = structuredData("/rules")
    expect(rest).toEqual([])
    expect(faq["@type"]).toBe("FAQPage")
    const questions = faq.mainEntity as Json[]
    expect(questions).toHaveLength(4)
    expect(questions[1]).toEqual({
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

  it("describes the strategy page as an article by TUDU", () => {
    expect(structuredData("/strategy")).toEqual([
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

  //the game screen is a tool, not a document: only the FAQ its setup panel shows
  it("gives the offline game the FAQ its setup panel shows", () => {
    const [faq, ...rest] = structuredData("/offline")
    expect(rest).toEqual([])
    expect(faq["@type"]).toBe("FAQPage")
    const questions = faq.mainEntity as Json[]
    expect(questions).toHaveLength(6)
    expect(questions[2]).toEqual({
      "@type": "Question",
      name: "How many difficulty levels does the computer have?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Eight, from Gus at level 1 to Magnus at level 8. The first four have habits you can use against them. Levels 1 to 6 look one move ahead, Clara two and Magnus three.",
      },
    })
  })
})
