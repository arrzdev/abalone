import { expect, test } from "@playwright/test"
import { openApp } from "./support/app"

// Each guide ends with links to the other three, so a reader who finished one
// finds the next and a crawler reaches every guide from each of them. The links
// are in the served HTML, in the page's language (/de/rules links /de/strategy),
// and sit below the way to the board, which stays on the first screen.

const GUIDES = [
  "/rules",
  "/strategy",
  "/opening-moves",
  "/starting-positions",
] as const

const CTA = "Play against the computer"

/** The hrefs inside the served related-guides block. */
function relatedLinks(html: string): string[] {
  const start = html.indexOf("data-related-guides")
  if (start === -1) return []
  const block = html.slice(start, html.indexOf("</nav>", start))
  return [...block.matchAll(/<a[^>]*href="([^"]*)"/g)].map(
    (match) => match[1],
  )
}

test.describe("related guides in the served HTML", () => {
  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "one HTTP pass is enough",
  )

  for (const prefix of ["", "/de"]) {
    for (const guide of GUIDES) {
      const path = `${prefix}${guide}`

      test(`${path} links the other three guides, each a 200 page`, async ({
        request,
      }) => {
        const response = await request.get(path, { maxRedirects: 0 })
        expect(response.status()).toBe(200)

        const links = relatedLinks(await response.text())
        expect(links.sort()).toEqual(
          GUIDES.filter((other) => other !== guide)
            .map((other) => `${prefix}${other}`)
            .sort(),
        )

        for (const link of links) {
          const target = await request.get(link, { maxRedirects: 0 })
          expect(target.status(), link).toBe(200)
        }
      })
    }
  }
})

test.describe("related guides at 375×667", () => {
  test.use({ viewport: { width: 375, height: 667 } })

  for (const guide of GUIDES) {
    test(`${guide}: the play button is on the first screen, the guides below it`, async ({
      page,
    }) => {
      await openApp(page, guide)

      const play = page
        .locator("main")
        .getByRole("link", { name: CTA, exact: true })
        .first()
      const playBox = await play.boundingBox()
      expect(playBox).not.toBeNull()
      expect(
        (playBox?.y ?? 0) + (playBox?.height ?? 0),
      ).toBeLessThanOrEqual(667)

      const related = page.locator("[data-related-guides]")
      await expect(related.getByRole("link")).toHaveCount(3)
      const relatedBox = await related.boundingBox()
      expect(relatedBox?.y ?? 0).toBeGreaterThan(667)
    })
  }
})
