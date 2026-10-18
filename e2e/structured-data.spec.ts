import type { APIRequestContext } from "@playwright/test"
import { expect, test } from "@playwright/test"

// The JSON-LD in the served HTML (tech-seo-spec item 4 on TUD-626), read the way
// a crawler reads it: before any JavaScript runs. Google only trusts structured
// data that matches what the page shows, so each check ties a field to the
// visible page. The exact payloads are pinned in
// apps/game/src/routing/structured-data.test.ts.

const ORIGIN = "https://abalone.tudu.dev"

type Json = Record<string, unknown>

test.skip(
  ({ browserName }) => browserName !== "chromium",
  "raw HTTP checks: one browser is enough",
)

async function served(request: APIRequestContext, path: string) {
  const response = await request.get(path)
  expect(response.status(), path).toBe(200)
  const html = await response.text()
  const blocks = [
    ...html.matchAll(
      /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g,
    ),
  ].map((match) => JSON.parse(match[1]) as Json)
  return { html, blocks }
}

/**
 * The served HTML as the text a reader sees: tags out, entities decoded.
 * Inline tags sit inside a run of text (`<strong>six</strong>.` reads "six."),
 * so only the others break words.
 */
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

function h1Of(html: string): string {
  const match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)
  return match ? visibleText(match[1]) : ""
}

function h2ById(html: string, id: string): string {
  const match = html.match(
    new RegExp(`<h2[^>]*id="${id}"[^>]*>([\\s\\S]*?)</h2>`),
  )
  return match ? visibleText(match[1]) : ""
}

test("home is a VideoGame on the canonical URL", async ({ request }) => {
  const { blocks } = await served(request, "/")

  expect(blocks).toHaveLength(1)
  expect(blocks[0]["@type"]).toBe("VideoGame")
  expect(blocks[0].url).toBe(`${ORIGIN}/`)
})

test("rules is a HowTo whose steps are sections on the page", async ({
  request,
}) => {
  const { html, blocks } = await served(request, "/rules")

  expect(blocks).toHaveLength(2)
  const [howTo] = blocks
  expect(howTo["@type"]).toBe("HowTo")
  expect(howTo.url).toBe(`${ORIGIN}/rules`)

  const text = visibleText(html)
  const steps = howTo.step as Json[]
  expect(steps).toHaveLength(5)
  for (const step of steps) {
    // each step points at a section that exists, under the same name
    const anchor = new URL(step.url as string).hash.slice(1)
    expect(h2ById(html, anchor), anchor).toBe(step.name)
    // and says what that section says
    expect(text, anchor).toContain(step.text as string)
  }
})

test("rules is also a FAQPage that says what the FAQ section says", async ({
  request,
}) => {
  const { html, blocks } = await served(request, "/rules")

  const faq = blocks.find((block) => block["@type"] === "FAQPage")
  const text = visibleText(html)
  const questions = (faq?.mainEntity ?? []) as Json[]
  expect(questions).toHaveLength(4)
  for (const question of questions) {
    const answer = question.acceptedAnswer as Json
    expect(text).toContain(question.name as string)
    expect(text).toContain(answer.text as string)
  }
})

test("strategy is an Article headed by its H1", async ({ request }) => {
  const { html, blocks } = await served(request, "/strategy")

  expect(blocks).toHaveLength(1)
  const [article] = blocks
  expect(article["@type"]).toBe("Article")
  expect(article.headline).toBe(h1Of(html))
  expect(article.url).toBe(`${ORIGIN}/strategy`)
})

test("the offline game and private pages carry none", async ({
  request,
}) => {
  for (const path of ["/offline", "/online", "/profile"]) {
    const { blocks } = await served(request, path)
    expect(blocks, path).toEqual([])
  }
})
