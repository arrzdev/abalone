import type { APIRequestContext } from "@playwright/test"
import { expect, test } from "@playwright/test"
import { openApp, signUp, uniqueUsername } from "./support/app"

// The public landing for online play (the `audit` document on TUD-1688, page
// design on TUD-1820). /online is the signed-in hub and stays out of the index;
// this page is the one a search for "play abalone online free" or "abalone with
// friends" lands on. Its copy makes product claims (an account is needed, there
// is no game code, a link lasts 7 days), so the text is pinned word for word.

const PATH = "/play-online"
const H1 = "Play Abalone online, free"
const CTA = "Play Online"
const MORE = "Other ways to play"

const INTRO =
  "You can play Abalone online with a friend for free, right in your browser. Create a free account, make a private invite link, and send it to whoever you want to play. The game starts when they open the link and accept, and you each take your turn whenever you like."

const STEPS_HEADING = "How to play Abalone with a friend online"
const STEPS = [
  "Create a free account.",
  'Choose a board setup and your side, then tap "Invite with a link".',
  "Send the link.",
  'Your friend opens it, creates an account or signs in, and taps "Accept and play".',
]

const FAQ = [
  [
    "Is online Abalone free?",
    "Yes. Playing online costs nothing. You need a free account.",
  ],
  [
    "Do I need to sign up?",
    "Yes, online games need an account, a username and a password. To play without one, play the computer or pass and play.",
  ],
  [
    "How do I play Abalone with a friend?",
    "Make an invite link from the Online page and send it. They accept and the game starts. You can also invite a friend by username.",
  ],
  [
    "Is the invite link private?",
    "Only whoever has the link can accept it, and only one person can. It expires after 7 days.",
  ],
  [
    "Do we have to be online at the same time?",
    "No. Take your turns whenever you like.",
  ],
  ["Is there a game code?", "No, you share a link instead."],
] as const

/** The served HTML as the text a reader sees: tags out, entities decoded. */
function visibleText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<\/?(?:strong|em|b|i|a|span|code)\b[^>]*>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim()
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/** An `<a href>` to `path` whose visible text is `text`. */
function linkPattern(path: string, text: string): RegExp {
  return new RegExp(
    `<a[^>]*href="${escapeRegExp(path)}"[^>]*>(?:\\s|<[^>]+>)*${escapeRegExp(text)}(?:\\s|<[^>]+>)*</a>`,
  )
}

async function servedHtml(
  request: APIRequestContext,
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

  test("answers first, under one H1", async ({ request }) => {
    const html = await servedHtml(request, PATH)
    const headings = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g)].map(
      (match) => visibleText(match[1]),
    )

    expect(headings).toEqual([H1])
    expect(visibleText(html)).toContain(INTRO)
  })

  test("lists the four steps, in order, under their heading", async ({
    request,
  }) => {
    const html = await servedHtml(request, PATH)
    const section = html.match(
      /<h2[^>]*id="with-a-friend"[^>]*>([\s\S]*?)<\/h2>[\s\S]*?<ol[^>]*>([\s\S]*?)<\/ol>/,
    )

    expect(section, "#with-a-friend with an <ol>").not.toBeNull()
    expect(visibleText(section?.[1] ?? "")).toBe(STEPS_HEADING)
    const items = [
      ...(section?.[2] ?? "").matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g),
    ].map((match) => visibleText(match[1]).replace(/^\d+\s*/, ""))
    expect(items).toEqual(STEPS)
  })

  test("answers the six questions, word for word", async ({ request }) => {
    const html = await servedHtml(request, PATH)
    const text = visibleText(html)

    expect(html).toMatch(/<h2[^>]*id="faq"/)
    for (const [question, answer] of FAQ) {
      expect(text).toContain(`${question} ${answer}`)
    }
  })

  // a signed-out reader sent to /online is bounced home, so the page names
  // the Online page without linking it, and sends the no-account reader to
  // the offline board
  test("links where a signed-out reader can go, and not to /online", async ({
    request,
  }) => {
    const html = await servedHtml(request, PATH)

    expect(html).toMatch(
      linkPattern("/offline", "play the computer or pass and play"),
    )
    expect(html).toMatch(linkPattern("/rules", "Abalone rules"))
    expect(html).toMatch(linkPattern("/strategy", "Abalone strategy tips"))
    expect(html).toMatch(linkPattern("/", MORE))
    // the page's own content: the desktop header's nav links /online on
    // every page and asks for sign-in itself
    const content = html.replace(/<nav[\s\S]*?<\/nav>/g, "")
    expect(content).not.toMatch(/<a[^>]*href="\/online"/)
  })

  // the CTA is a button that runs the sign-in gate, not a link to the hub
  test("offers Play Online under the intro and again at the end", async ({
    request,
  }) => {
    const html = await servedHtml(request, PATH)
    const buttons = [
      ...html.matchAll(/<button[^>]*>(?:\s|<[^>]+>)*Play Online/g),
    ]

    expect(buttons).toHaveLength(2)
  })

  for (const path of ["/", "/rules"]) {
    test(`${path} links to the play online page`, async ({ request }) => {
      const html = await servedHtml(request, path)
      expect(html).toMatch(/<a[^>]*href="\/play-online"/)
    })
  }
})

test.describe("in the browser", () => {
  test("Play Online asks a visitor to sign in, and stays on the page", async ({
    page,
  }) => {
    await openApp(page, PATH)
    await page
      .getByRole("main")
      .getByRole("button", { name: CTA })
      .first()
      .click()

    await expect(
      page.getByRole("dialog", { name: "Sign in to play online" }),
    ).toBeVisible()
    await expect(page).toHaveURL(PATH)
  })

  test("Play Online takes a signed-in player to their online games", async ({
    page,
  }) => {
    await signUp(page, uniqueUsername("po"))
    await openApp(page, PATH)
    await page
      .getByRole("main")
      .getByRole("button", { name: CTA })
      .first()
      .click()

    await expect(page).toHaveURL("/online")
    await expect(page.getByRole("dialog")).toHaveCount(0)
  })

  test("the bar title is no second heading", async ({ page }) => {
    await openApp(page, PATH)
    const heading = page.getByRole("heading", { level: 1 })
    await expect(heading).toHaveCount(1)
    await expect(heading).toHaveText(H1)
  })

  // the page design (TUD-1820 §3): the first Play Online button ends on the
  // first screen of the smallest phones we support, with no sideways scroll
  for (const viewport of [
    { width: 320, height: 460 },
    { width: 375, height: 548 },
    { width: 390, height: 664 },
  ]) {
    test(`Play Online is on the first screen at ${viewport.width}×${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport)
      await openApp(page, PATH)
      const cta = page
        .getByRole("main")
        .getByRole("button", { name: CTA })
        .first()
      const box = await cta.boundingBox()

      expect(box, "Play Online is drawn").not.toBeNull()
      expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(
        viewport.height,
      )
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth,
      )
      expect(overflow, "no sideways scroll").toBe(false)
    })
  }
})
