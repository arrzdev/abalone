import { expect, test } from "@playwright/test"
import { openApp, signUp, uniqueUsername } from "./support/app"

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
  await expect(page.getByRole("alert")).toHaveCount(0)
})
