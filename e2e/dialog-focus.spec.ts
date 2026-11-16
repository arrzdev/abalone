import type { Locator, Page } from "@playwright/test"
import {
  openApp,
  signUp,
  startOfflineGame,
  uniqueUsername,
} from "./support/app"
import { expect, test } from "./support/test"

// Every dialog, sheet and menu on the main screens, keyboard only, at a phone
// and a desktop width: it takes focus when it opens, Tab and Shift+Tab stay
// inside it, Escape closes it and focus is back on what opened it (WCAG 2.4.3).
// The trigger is focused and opened with Enter, never clicked.
//
// An open bug is a known failure: a test.fail on its test, with the task that
// tracks it. A known failure must still fail, so when the bug is fixed the
// test goes red until the entry is removed.

const VIEWPORTS = [
  { name: "390", width: 390, height: 844 },
  { name: "1280", width: 1280, height: 800 },
]
const STOPS = 10

const insideDialog = (page: Page) =>
  page.evaluate(
    () =>
      document.activeElement !== document.body &&
      !!document.activeElement?.closest('[role="dialog"]'),
  )

async function opensWithFocus(
  page: Page,
  trigger: Locator,
  dialog: Locator,
): Promise<void> {
  await trigger.focus()
  await page.keyboard.press("Enter")
  await expect(dialog).toBeVisible()
  // On open focus is already inside, not on the page behind.
  await expect.poll(() => insideDialog(page)).toBe(true)
}

async function staysInside(page: Page): Promise<void> {
  for (const key of ["Tab", "Shift+Tab"]) {
    for (let stop = 1; stop <= STOPS; stop++) {
      await page.keyboard.press(key)
      expect(
        await insideDialog(page),
        `${key} #${stop} left the dialog`,
      ).toBe(true)
    }
  }
}

async function escapeReturns(
  page: Page,
  trigger: Locator,
  dialog: Locator,
): Promise<void> {
  await page.keyboard.press("Escape")
  await expect(dialog).toHaveCount(0)
  await expect(trigger).toBeFocused()
}

const visibleButton = (page: Page, name: string) =>
  page.getByRole("button", { name }).filter({ visible: true }).first()

for (const viewport of VIEWPORTS) {
  test.describe(`dialog focus (${viewport.name})`, () => {
    test.use({
      viewport: { width: viewport.width, height: viewport.height },
      serviceWorkers: "block",
    })
    test.skip(
      ({ browserName }) => browserName !== "chromium",
      "the keyboard checks run in one engine",
    )

    test("settings", async ({ page }) => {
      await openApp(page, "/")
      const trigger = visibleButton(page, "Settings")
      const dialog = page.getByRole("dialog")
      await opensWithFocus(page, trigger, dialog)
      await staysInside(page)
      await escapeReturns(page, trigger, dialog)
    })

    test("sign in", async ({ page }) => {
      await openApp(page, "/")
      const trigger = visibleButton(page, "Sign in")
      const dialog = page.getByRole("dialog")
      await opensWithFocus(page, trigger, dialog)
      await staysInside(page)
      await escapeReturns(page, trigger, dialog)
    })

    test("resign confirmation", async ({ page }) => {
      await startOfflineGame(page, "vs Computer")
      const trigger = page.getByRole("button", { name: "Resign" })
      const dialog = page
        .getByRole("dialog")
        .filter({ hasText: "Resign the game?" })
      await opensWithFocus(page, trigger, dialog)
      await staysInside(page)
      await escapeReturns(page, trigger, dialog)
    })

    test("the select list in settings", async ({ page }) => {
      await openApp(page, "/")
      await visibleButton(page, "Settings").click()
      const dialog = page.getByRole("dialog")
      await expect(dialog).toBeVisible()
      const trigger = dialog.locator('[aria-haspopup="listbox"]').first()
      await trigger.focus()
      await page.keyboard.press("Enter")
      const list = page.getByRole("listbox")
      await expect(list).toBeVisible()
      // The list is a menu: Escape closes it alone, focus stays on its
      // trigger, and the sheet behind it stays open.
      await page.keyboard.press("Escape")
      await expect(list).toHaveCount(0)
      await expect(trigger).toBeFocused()
      await expect(dialog).toBeVisible()
    })
  })
}

// The account menu is the desktop header's: a phone has a profile button.
test.describe("dialog focus (1280): the account menu", () => {
  test.use({
    viewport: { width: 1280, height: 800 },
    serviceWorkers: "block",
  })
  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "the keyboard checks run in one engine",
  )

  test("account menu", async ({ page }) => {
    test.slow()
    await signUp(page, uniqueUsername("focus"))
    const trigger = page.getByRole("button", { name: "Profile" }).first()
    const menu = page.getByRole("menu")
    await trigger.focus()
    await page.keyboard.press("Enter")
    await expect(menu).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(menu).toHaveCount(0)
    await expect(trigger).toBeFocused()
  })
})
