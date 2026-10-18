import { readdirSync, readFileSync } from "node:fs"
import { expect, test } from "@playwright/test"
import { openApp, signUp, uniqueUsername } from "./support/app"

// The line under the name in the invite composer is as tall as the longest
// message it can say (StatusLine). One message that wraps in one language makes
// the line two lines tall there, and on a 375x667 phone that is the 20px that
// makes the composer scroll under the sheet's bottom fade. So every language's
// hint and every refusal it holds room for fit on one line at that width.
// The rules behind it: docs/ui-layout-checks.md.

const LOCALES_DIRECTORY = "apps/game/src/i18n/locales"

/** What the app stores for the language switch in settings (language.spec.ts). */
const LANGUAGE_STORAGE_KEY = "abalone_language"

function languages(): string[] {
  return readdirSync(LOCALES_DIRECTORY).sort()
}

/** The composer's hint under the name, in `language`. */
function usernameHint(language: string): string {
  const path = `${LOCALES_DIRECTORY}/${language}/online.json`
  return JSON.parse(readFileSync(path, "utf8")).compose.username_hint
}

test.describe("on a 375x667 phone", () => {
  test.use({ viewport: { width: 375, height: 667 } })

  test("every message the invite composer's name line holds room for fits on one line in every language", async ({
    page,
  }) => {
    test.slow()
    await signUp(page, uniqueUsername("locales"))

    const wrapped: Record<string, string[]> = {}
    for (const language of languages()) {
      await page.evaluate(
        ([key, value]) => localStorage.setItem(key, value),
        [LANGUAGE_STORAGE_KEY, language],
      )
      await openApp(page, "/online?invite=new")
      const composer = page.getByRole("dialog")
      await expect(
        composer.getByText(usernameHint(language)),
      ).toBeVisible()

      // The hint and the held copies of every message, each against one line
      // of the cell they share. Every item in a grid cell stretches to the
      // tallest of them, so each is measured at its own height for the moment
      // of the read, and put back.
      const lines = await composer
        .locator("[data-reserve]")
        .first()
        .evaluate((reserved) => {
          const cell = reserved.parentElement as HTMLElement
          const lineHeight = Number.parseFloat(
            getComputedStyle(cell).lineHeight,
          )
          const items = [...cell.children].slice(1) as HTMLElement[]
          for (const item of items) item.style.alignSelf = "start"
          const measured = items.map((item) => ({
            text:
              item.getAttribute("data-reserve") ?? item.textContent ?? "",
            wraps: item.getBoundingClientRect().height > lineHeight + 0.5,
          }))
          for (const item of items) item.style.alignSelf = ""
          return measured
        })
      const tooLong = lines
        .filter((line) => line.wraps)
        .map((line) => line.text)
      if (tooLong.length > 0) wrapped[language] = tooLong
    }

    expect(wrapped).toEqual({})
  })
})
