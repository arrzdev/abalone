import { expect, test } from "@playwright/test"
import { openApp } from "./support/app"

// The language is picked in the settings sheet, applies at once and is still
// the one in use after a reload.
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
    page.getByRole("tab", { name: "gegen Computer" }),
  ).toBeAttached()

  await page.reload()
  await expect(
    page.getByRole("tab", { name: "gegen Computer" }),
  ).toBeVisible({
    timeout: 60_000,
  })
  await expect(page.getByRole("tab", { name: "vs Computer" })).toHaveCount(
    0,
  )
})
