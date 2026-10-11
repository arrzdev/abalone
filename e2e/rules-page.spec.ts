import { expect, test } from "@playwright/test"
import { openApp } from "./support/app"

// The rules page as a search result lands on it: the full rules as text, beside
// the diagrams it already had (the `rules-text` document on TUD-626). The page
// is server rendered, so most checks read the served HTML, the same bytes a
// crawler gets on its first pass. One check opens the page in each browser
// project, to see the heading a player actually sees.

const H1 = "Abalone rules: how to play"

// The sections in reading order; each id is a link target (/rules#sumito).
const SECTIONS = [
  ["goal", "The goal"],
  ["turns", "Who moves first"],
  ["directions", "How marbles move"],
  ["moving-groups", "Moving one, two or three marbles"],
  ["sumito", "Pushing: the sumito"],
  ["pushing-off", "Pushing marbles off the board"],
  ["how-to-win", "How to win"],
  ["starting-positions", "Starting positions"],
  ["faq", "Frequently asked"],
] as const

// Every opening the setup picker offers (PLAYABLE_SETUPS), by its name in the
// game, and none it does not.
const OPENINGS = [
  "Standard",
  "Belgian daisy",
  "German daisy",
  "Dutch daisy",
  "Swiss daisy",
  "Alien",
  "Domination",
  "Infiltration",
  "The Wall",
]

/** The served HTML as the text a reader sees: tags out, entities decoded. */
function visibleText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
}

function stripTags(html: string): string {
  return visibleText(html).trim()
}

test.describe("served HTML", () => {
  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "raw HTTP checks: one browser is enough",
  )

  let html = ""
  test.beforeEach(async ({ request }) => {
    const response = await request.get("/rules")
    expect(response.status()).toBe(200)
    html = await response.text()
  })

  test("has one H1, worded as in page-copy", () => {
    const headings = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g)].map(
      (match) => stripTags(match[1]),
    )
    expect(headings).toEqual([H1])
  })

  test("opens with what the game is, and links to both ways in", () => {
    const text = visibleText(html)
    expect(text).toContain(
      "Abalone is a two-player strategy game on a hexagonal board. Each player has 14 marbles. You win by pushing six of your opponent's marbles off the board.",
    )
    expect(html).toMatch(/<a[^>]*href="\/"[^>]*>play Abalone online<\/a>/)
    expect(html).toMatch(
      /<a[^>]*href="\/offline"[^>]*>try it against the computer<\/a>/,
    )
  })

  test("has every section, in order, each with its anchor", () => {
    const found = [
      ...html.matchAll(/<h2[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/h2>/g),
    ]
      .map((match) => [match[1], stripTags(match[2])])
      .filter(([id]) => SECTIONS.some(([known]) => known === id))
    expect(found).toEqual(SECTIONS.map(([id, title]) => [id, title]))
  })

  test("states the rules a search for them is after", () => {
    const text = visibleText(html)
    // who opens, and that a turn cannot be skipped
    expect(text).toContain("Black goes first.")
    expect(text).toContain("you cannot pass")
    // the sumito ratios, each one on its own
    for (const ratio of [
      "2 marbles push 1",
      "3 marbles push 1",
      "3 marbles push 2",
    ]) {
      expect(text).toContain(ratio)
    }
    expect(text).toContain("Equal numbers never push")
    expect(text).toContain("You can never push your own marbles.")
  })

  test("names every opening the picker offers, and no other", () => {
    const section = html.slice(
      html.indexOf('id="starting-positions"'),
      html.indexOf('id="faq"'),
    )
    const text = visibleText(section)
    for (const name of OPENINGS) expect(text).toContain(name)
    expect(text).not.toMatch(/\bCustom\b/)
    // the three described ones carry their own anchors
    for (const id of ["standard", "belgian-daisy", "german-daisy"]) {
      expect(section).toContain(`id="${id}"`)
    }
  })

  test("keeps the six diagrams", () => {
    expect(html.match(/<figure/g)).toHaveLength(6)
  })

  test("answers the common questions", () => {
    const text = visibleText(html)
    for (const question of [
      "Can I move marbles diagonally?",
      "Can a single marble push?",
      "What if my push is blocked by my own marble?",
      "Is Abalone solved?",
    ]) {
      expect(text).toContain(question)
    }
  })

  test("ends with a way to play, and a way to play the computer", () => {
    expect(html).toMatch(/<a[^>]*href="\/"[^>]*>Play now<\/a>/)
    expect(html).toMatch(
      /<a[^>]*href="\/offline"[^>]*>Play against the computer<\/a>/,
    )
  })
})

// The heading a player sees: on a phone the page has its own bar, above `lg`
// the page title. Either way there is one H1 and it is the page-copy one.
test("shows the page-copy H1 at this width", async ({ page }) => {
  await openApp(page, "/rules")

  const heading = page.getByRole("heading", { level: 1 })
  await expect(heading).toHaveCount(1)
  await expect(heading).toHaveText(H1)
  await expect(heading).toBeVisible()
})
