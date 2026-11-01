import type { Page } from "@playwright/test"
import { expect, test } from "@playwright/test"
import { openApp, signUp, uniqueUsername } from "./support/app"

// Whatever sits on top at the middle of the camera badge must be the badge (or
// its icon), or the badge is under the picture and cannot be seen or pressed.
async function expectBadgeOnTop(page: Page): Promise<void> {
  const badge = page.locator("[data-camera-badge]")
  await expect(badge).toBeVisible()
  const isOnTop = await badge.evaluate((element) => {
    const box = element.getBoundingClientRect()
    const topmost = document.elementFromPoint(
      box.left + box.width / 2,
      box.top + box.height / 2,
    )
    return topmost !== null && element.contains(topmost)
  })
  expect(isOnTop).toBe(true)
}

// A new picture goes through the real upload: resized in the browser, stored in
// the backend's local R2 and served back from it.
test("a signed-in player changes their picture", async ({ page }) => {
  await signUp(page, uniqueUsername("pic"))
  await openApp(page, "/profile")

  // A picture drawn on the spot, so the suite carries no binary fixture.
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
  const buffer = Buffer.from(dataUrl.split(",")[1] ?? "", "base64")

  await page.locator('input[type="file"]').setInputFiles({
    name: "avatar.png",
    mimeType: "image/png",
    buffer,
  })

  const picture = page.locator('main img[src*="/avatars/"]').first()
  await expect(picture).toBeVisible()
  await expect
    .poll(() =>
      picture.evaluate((image: HTMLImageElement) => image.naturalWidth),
    )
    .toBeGreaterThan(0)
  // The line under the name is an alert that is always there, saying nothing
  // until an upload fails; it must still be saying nothing.
  await expect(
    page.getByRole("alert").filter({ hasText: /\S/ }),
  ).toHaveCount(0)
})

test("the camera badge is on top of the picture, with or without a photo", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 667 })
  const username = uniqueUsername("badge")
  await signUp(page, username)
  await openApp(page, "/profile")

  // No photo yet: the initials stand in, on a colour of the name's own.
  const initials = page.locator("main [data-avatar-initials]").first()
  await expect(initials).toHaveText(username.slice(0, 1).toUpperCase())
  await expectBadgeOnTop(page)

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

  const picture = page.locator('main img[src*="/avatars/"]').first()
  await expect
    .poll(() =>
      picture.evaluate((image: HTMLImageElement) => image.naturalWidth),
    )
    .toBeGreaterThan(0)
  await expectBadgeOnTop(page)
})
