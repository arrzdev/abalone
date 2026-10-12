import { expect, test } from "@playwright/test"
import { openApp } from "./support/app"

// The strategy page (the `strategy-page` document on TUD-626), the home H1, and
// the links between home, rules and strategy (tech-seo-spec item 7). Pages are
// server rendered, so most checks read the served HTML, the same bytes a
// crawler gets on its first pass.

const STRATEGY_H1 = "Abalone strategy: 7 tips to win"
const HOME_H1 = "Play Abalone online, free"

// The tips in reading order; each id is a link target (/strategy#center).
const SECTIONS = [
  ["center", "1. Control the center"],
  ["groups-of-three", "2. Keep your groups of three"],
  ["edge", "3. Stay away from the edge"],
  ["count", "4. Count before you push"],
  ["opening", "5. Choose your opening on purpose"],
  ["attack-as-a-group", "6. Attack as a group, not as a hero"],
  ["tempo", "7. Win the tempo, not the marble"],
  ["mistakes", "Common mistakes"],
  ["practise", "Practise"],
] as const

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
    .trim()
}

function headingsIn(html: string, level: 1 | 2): Array<[string, string]> {
  const pattern = new RegExp(
    `<h${level}([^>]*)>([\\s\\S]*?)</h${level}>`,
    "g",
  )
  return [...html.matchAll(pattern)].map((match) => [
    match[1].match(/id="([^"]+)"/)?.[1] ?? "",
    visibleText(match[2]),
  ])
}

/** An `<a href>` to `path` whose visible text is `text`. */
function linkPattern(path: string, text: string): RegExp {
  const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return new RegExp(
    `<a[^>]*href="${path}"[^>]*>(?:\\s|<[^>]+>)*${escaped}(?:\\s|<[^>]+>)*</a>`,
  )
}

async function servedHtml(
  request: import("@playwright/test").APIRequestContext,
  path: string,
): Promise<string> {
  const response = await request.get(path)
  expect(response.status(), path).toBe(200)
  return response.text()
}

test.describe("served HTML", () => {
  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "raw HTTP checks: one browser is enough",
  )

  test.describe("/strategy", () => {
    test("has one H1, worded as in page-copy", async ({ request }) => {
      const html = await servedHtml(request, "/strategy")
      expect(headingsIn(html, 1).map(([, text]) => text)).toEqual([
        STRATEGY_H1,
      ])
    })

    test("opens by pointing at the computer and at the rules", async ({
      request,
    }) => {
      const html = await servedHtml(request, "/strategy")
      expect(visibleText(html)).toContain(
        "Abalone looks simple and is not. These seven habits take most beginners from losing marbles to winning pushes.",
      )
      expect(html).toMatch(
        linkPattern(
          "/offline\\?mode=ai",
          "free game against the computer",
        ),
      )
      expect(html).toMatch(linkPattern("/rules", "Abalone rules"))
    })

    test("has the seven tips and the closing sections, in order, each with its anchor", async ({
      request,
    }) => {
      const html = await servedHtml(request, "/strategy")
      expect(headingsIn(html, 2)).toEqual(
        SECTIONS.map(([id, title]) => [id, title]),
      )
    })

    test("gives each tip its advice as text", async ({ request }) => {
      const text = visibleText(await servedHtml(request, "/strategy"))
      for (const sentence of [
        "Marbles in the middle have six neighbours and room to move.",
        "Three connected marbles in a line can push two, and cannot easily be pushed.",
        "Every marble on the outer ring can be lost to a single sumito.",
        "Before each push, count both lines and check what your move leaves open.",
        "In the standard layout, nobody can push on move one",
        "Bring a second line to the same area before you commit.",
        "Abalone is a game of who runs out of good moves first.",
        "Splitting a three into two twos just before the opponent's three arrives.",
      ]) {
        expect(text).toContain(sentence)
      }
    })

    // the Practise card's actions are the last play block
    // (e2e/play-block.spec.ts, content-play-block on TUD-820)
    test("ends with a way to practise, and the other ways to play", async ({
      request,
    }) => {
      const html = await servedHtml(request, "/strategy")
      expect(html).toMatch(
        linkPattern("/offline\\?mode=ai", "Play against the computer"),
      )
      expect(html).toMatch(linkPattern("/", "Other ways to play"))
      expect(html).not.toContain("Play a friend online")
    })
  })

  test.describe("home", () => {
    test("has one H1, worded as in page-copy, and the line under it", async ({
      request,
    }) => {
      const html = await servedHtml(request, "/")
      expect(headingsIn(html, 1).map(([, text]) => text)).toEqual([
        HOME_H1,
      ])
      expect(visibleText(html)).toContain(
        "Push six of your opponent's marbles off the board. Play the computer, pass the device, or invite a friend.",
      )
    })

    // descriptive anchors, so the link tells a crawler what the page is about
    test("links to the rules, the strategy tips and the offline game", async ({
      request,
    }) => {
      const html = await servedHtml(request, "/")
      expect(html).toMatch(linkPattern("/rules", "Abalone rules"))
      expect(html).toMatch(
        linkPattern("/strategy", "Abalone strategy tips"),
      )
      expect(html).toMatch(/<a[^>]*href="\/offline"/)
    })
  })

  test("the rules page links to the strategy tips", async ({
    request,
  }) => {
    const html = await servedHtml(request, "/rules")
    expect(html).toMatch(
      linkPattern("/strategy", "Abalone strategy: 7 tips"),
    )
  })
})

// The heading a player and a screen reader get, at this project's width.
for (const [path, h1] of [
  ["/strategy", STRATEGY_H1],
  ["/", HOME_H1],
] as const) {
  test(`${path} has the page-copy H1 at this width`, async ({ page }) => {
    await openApp(page, path)

    const heading = page.getByRole("heading", { level: 1 })
    await expect(heading).toHaveCount(1)
    await expect(heading).toHaveText(h1)
  })
}

test("the strategy page shows its H1", async ({ page }) => {
  await openApp(page, "/strategy")
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
})
