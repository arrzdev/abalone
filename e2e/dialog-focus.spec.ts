import type { Locator, Page } from "@playwright/test"
import { expect, test } from "@playwright/test"
import { openApp } from "./support/app"

// A keyboard user can work an open dialog: focus moves into it when it opens,
// Tab and Shift+Tab go round inside it and never reach the page behind, and
// Escape closes it and puts focus back on the button that opened it.

// The desktop shape, the centred dialog, which is where a keyboard is.
test.use({ viewport: { width: 1280, height: 800 } })

// More presses than either dialog has stops, so the walk comes back round.
const TAB_PRESSES = 12

/** True when the focused element sits inside the open dialog. */
function focusIsInside(dialog: Locator): Promise<boolean> {
  return dialog.evaluate((element) =>
    element.contains(document.activeElement),
  )
}

async function expectFocusStaysInside(
  page: Page,
  dialog: Locator,
  key: "Tab" | "Shift+Tab",
): Promise<void> {
  for (let press = 0; press < TAB_PRESSES; press++) {
    await page.keyboard.press(key)
    expect(
      await focusIsInside(dialog),
      `focus inside the dialog after ${press + 1} × ${key}`,
    ).toBe(true)
  }
}

async function expectDialogTakesTrapsAndReturnsFocus(
  page: Page,
  trigger: Locator,
): Promise<void> {
  await trigger.focus()
  await page.keyboard.press("Enter")

  const dialog = page.getByRole("dialog")
  await expect(dialog).toBeVisible()
  await expect.poll(() => focusIsInside(dialog)).toBe(true)

  await expectFocusStaysInside(page, dialog, "Tab")
  await expectFocusStaysInside(page, dialog, "Shift+Tab")

  await page.keyboard.press("Escape")
  await expect(dialog).toBeHidden()
  await expect(trigger).toBeFocused()
}

test("the settings dialog takes, keeps and gives back focus", async ({
  page,
}) => {
  await openApp(page, "/rules")
  const trigger = page
    .getByRole("button", { name: "Settings" })
    .filter({ visible: true })
    .first()
  await expectDialogTakesTrapsAndReturnsFocus(page, trigger)
})

test("the sign in dialog takes, keeps and gives back focus", async ({
  page,
}) => {
  await openApp(page, "/rules")
  const trigger = page
    .getByRole("button", { name: "Sign in" })
    .filter({ visible: true })
    .first()
  await expectDialogTakesTrapsAndReturnsFocus(page, trigger)
})
