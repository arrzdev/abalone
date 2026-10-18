import type { Page } from "@playwright/test"
import { expect, test } from "@playwright/test"
import { signUp, uniqueUsername } from "./support/app"

// /online is rendered by the worker, which cannot see the token, and then
// hydrated on a device that can. A guest's first client render used to differ
// from that html, and React threw error #418 on every cold load of the page.

const VIEWPORTS = [
  { name: "phone", width: 375, height: 812 },
  { name: "desktop", width: 1440, height: 900 },
]

/**
 * Every uncaught error the page throws from now on.
 *
 * Uncaught errors only: the e2e api runs on another port, so the report-only
 * CSP fills the console with notices production never shows.
 */
function collectErrors(page: Page): string[] {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  return errors
}

for (const viewport of VIEWPORTS) {
  test(`a guest loading /online on a ${viewport.name} hits no errors`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport)
    const errors = collectErrors(page)

    await page.goto("/online")
    await page.waitForLoadState("networkidle")

    // The guard still sends a guest home to sign in.
    await expect(page).toHaveURL(/\/$/)
    expect(errors, errors.join("\n")).toEqual([])
  })

  test(`a signed-in player reloading /online on a ${viewport.name} hits no errors`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport)
    await signUp(page, uniqueUsername("hydrate"))
    const errors = collectErrors(page)

    await page.goto("/online")
    await page.waitForLoadState("networkidle")

    await expect(page).toHaveURL(/\/online$/)
    expect(errors, errors.join("\n")).toEqual([])
  })
}
