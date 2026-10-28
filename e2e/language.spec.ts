import { expect, test } from "@playwright/test"
import { openApp } from "./support/app"

// The language is picked in the settings sheet, applies at once, moves the
// page to that language's URL and is still the one in use after a reload.
test("switching the language translates the app and survives a reload", async ({
  page,
}) => {
  await openApp(page, "/offline")
  await expect(
    page.getByRole("tab", { name: "vs Computer" }),
  ).toBeVisible()

  await page
    .getByRole("button", { name: "Settings" })
    .filter({ visible: true })
    .first()
    .click()
  await page.getByRole("button", { name: "Select Language" }).click()
  await page.getByRole("option", { name: "Deutsch" }).click()

  await expect(page.locator("html")).toHaveAttribute("lang", "de")
  await expect(
    page.getByRole("tab", { name: "Gegen Computer" }),
  ).toBeAttached()
  // the page moves to its German URL (docs/locale-urls.md)
  await expect(page).toHaveURL(/\/de\/offline$/)

  await page.reload()
  await expect(
    page.getByRole("tab", { name: "Gegen Computer" }),
  ).toBeVisible({
    timeout: 60_000,
  })
  await expect(page.getByRole("tab", { name: "vs Computer" })).toHaveCount(
    0,
  )
})

// A visitor whose browser is set to Japanese gets the page in Japanese, and
// the document says so, for screen readers and search engines alike.
test.describe("a browser set to Japanese", () => {
  test.use({ locale: "ja-JP" })

  test("marks the page as Japanese", async ({ page }) => {
    await openApp(page, "/offline")

    await expect(page.locator("html")).toHaveAttribute("lang", "ja")
  })
})
