import type { Page } from "@playwright/test"
import { signUp, uniqueUsername } from "./support/app"
import { expect, test } from "./support/test"

// /profile is rendered by the worker, which cannot see the token, and then
// hydrated on a device that can. Anything the first client render reads from
// the device (a cached profile, a saved record) and the html did not have is a
// tree React cannot hydrate, and it throws error #418 on every cold load.

const VIEWPORTS = [
  { name: "phone", width: 375, height: 812 },
  { name: "desktop", width: 1280, height: 800 },
]

/** Uploads a picture drawn on the spot and waits until the page shows it. */
async function uploadPicture(page: Page): Promise<void> {
  const dataUrl = await page.evaluate(() => {
    const canvas = document.createElement("canvas")
    canvas.width = 64
    canvas.height = 64
    const context = canvas.getContext("2d")
    if (!context) throw new Error("no 2d context")
    context.fillStyle = "#e0662f"
    context.fillRect(0, 0, 64, 64)
    return canvas.toDataURL("image/png")
  })
  await page.locator('input[type="file"]').setInputFiles({
    name: "avatar.png",
    mimeType: "image/png",
    buffer: Buffer.from(dataUrl.split(",")[1] ?? "", "base64"),
  })
  await expect(
    page.locator('main img[src*="/avatars/"]').first(),
  ).toBeVisible()
}

for (const viewport of VIEWPORTS) {
  for (const withPicture of [false, true]) {
    const who = withPicture ? "with a picture" : "without a picture"

    test(`a signed-in player ${who} reloading /profile on a ${viewport.name} hits no errors`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport)
      // Same wait as online-hydration.spec.ts: a realtime ticket cut off by the
      // reload logs an uncaught error on WebKit that the app handles.
      await Promise.all([
        page.waitForEvent("websocket"),
        signUp(page, uniqueUsername("profhyd")),
      ])

      await page.goto("/profile")
      await page.waitForLoadState("networkidle")
      if (withPicture) await uploadPicture(page)

      // Uncaught errors only, from the full load below: the e2e api runs on
      // another port, so the report-only CSP fills the console with notices
      // production never shows.
      const errors: string[] = []
      page.on("pageerror", (error) => errors.push(error.message))

      await page.reload()
      await page.waitForLoadState("networkidle")

      await expect(page).toHaveURL(/\/profile$/)
      expect(errors, errors.join("\n")).toEqual([])
    })
  }
}
