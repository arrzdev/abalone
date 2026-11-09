import type { Page } from "@playwright/test"
import { startOfflineGame } from "./support/app"
import { moveList, playMove } from "./support/board"
import { expectNoClippedText, expectNoLayoutShift } from "./support/layout"
import { expect, test } from "./support/test"

// A phone game can be finished and started again without sight or a pointer:
// the sheets take focus and give it back, the result has a name, the eval bar
// says what it shows, and the status line says who won and how.

test.use({ viewport: { width: 375, height: 667 } })

/** Whether focus is on an element inside the first match of `selector`. */
function focusInside(page: Page, selector: string): Promise<boolean> {
  return page.evaluate((selector) => {
    const active = document.activeElement
    const scope = document.querySelector(selector)
    return active !== null && scope?.contains(active) === true
  }, selector)
}

function focusIsOnBody(page: Page): Promise<boolean> {
  return page.evaluate(
    () =>
      document.activeElement === null ||
      document.activeElement === document.body,
  )
}

const OPEN_DIALOG = "[role=dialog][aria-modal=true][data-open=true]"

async function openResignWithKeyboard(page: Page): Promise<void> {
  const resign = page.getByRole("button", { name: "Resign" })
  await resign.focus()
  // A press that lands anywhere else opens nothing, and the wait for the dialog
  // below would then fail without saying why.
  await expect(resign).toBeFocused()
  await page.keyboard.press("Enter")
  await expect(
    page.getByRole("dialog", { name: "Resign the game?" }),
  ).toBeVisible()
}

/** Plays one move, waits for the reply, and resigns from the sheet. */
async function resignTheGame(page: Page): Promise<void> {
  await playMove(page, "c5", "d5")
  await expect(moveList(page)).toHaveCount(2, { timeout: 30_000 })
  await page.getByRole("button", { name: "Resign" }).click()
  await page
    .getByRole("dialog", { name: "Resign the game?" })
    .getByRole("button", { name: "Resign" })
    .click()
  await expect(
    page.getByRole("dialog").getByText("by resignation").first(),
  ).toBeVisible()
}

test.describe("modal sheets hold focus", () => {
  test("the Resign sheet opened from the keyboard takes focus", async ({
    page,
  }) => {
    await startOfflineGame(page, "vs Computer")
    await openResignWithKeyboard(page)
    await expect.poll(() => focusInside(page, OPEN_DIALOG)).toBe(true)
  })

  test("Tab and Shift+Tab stay inside the open Resign sheet", async ({
    page,
  }) => {
    await startOfflineGame(page, "vs Computer")
    await openResignWithKeyboard(page)
    await expect.poll(() => focusInside(page, OPEN_DIALOG)).toBe(true)

    for (const key of ["Tab", "Tab", "Tab", "Tab", "Shift+Tab"]) {
      await page.keyboard.press(key)
      expect(
        await focusInside(page, OPEN_DIALOG),
        `focus after ${key}`,
      ).toBe(true)
    }
    for (let step = 0; step < 4; step += 1) {
      await page.keyboard.press("Shift+Tab")
      expect(
        await focusInside(page, OPEN_DIALOG),
        "focus after Shift+Tab",
      ).toBe(true)
    }
  })

  test("closing the Resign sheet gives focus back to Resign", async ({
    page,
  }) => {
    await startOfflineGame(page, "vs Computer")
    const resign = page.getByRole("button", { name: "Resign" })

    await openResignWithKeyboard(page)
    await page.keyboard.press("Escape")
    await expect(page.getByRole("dialog")).toHaveCount(0)
    await expect(resign).toBeFocused()

    await openResignWithKeyboard(page)
    await page
      .getByRole("dialog", { name: "Resign the game?" })
      .getByRole("button", { name: "Keep playing" })
      .press("Enter")
    await expect(page.getByRole("dialog")).toHaveCount(0)
    await expect(resign).toBeFocused()
  })

  test("a tap on Resign moves focus in without drawing a focus ring", async ({
    page,
  }) => {
    await startOfflineGame(page, "vs Computer")
    // Making the page behind the sheet inert moves nothing on it.
    await expectNoLayoutShift(
      page.locator("body"),
      () => page.getByRole("button", { name: "Resign" }).click(),
      {
        until: () =>
          expect(
            page.getByRole("dialog", { name: "Resign the game?" }),
          ).toBeVisible(),
      },
    )
    await expect.poll(() => focusInside(page, OPEN_DIALOG)).toBe(true)
    expect(
      await page.evaluate(() => document.querySelector(":focus-visible")),
    ).toBeNull()
  })

  test("the Game over sheet takes focus and returns it to the page", async ({
    page,
  }) => {
    await startOfflineGame(page, "vs Computer")
    await resignTheGame(page)
    await expect.poll(() => focusInside(page, OPEN_DIALOG)).toBe(true)

    await page.keyboard.press("Escape")
    await expect(page.getByRole("dialog")).toHaveCount(0)
    // The control that opened the Resign sheet is gone with the game, so focus
    // goes to the page, never back to nowhere.
    await expect.poll(() => focusIsOnBody(page)).toBe(false)
  })
})

test.describe("the end of the game is announced", () => {
  test("the Game over sheet is named by its heading and described by how it ended", async ({
    page,
  }) => {
    await startOfflineGame(page, "vs Computer")
    await resignTheGame(page)

    const dialog = page.getByRole("dialog", { name: /Won!$/ })
    await expect(dialog).toBeVisible()
    const heading = dialog.getByRole("heading", {
      level: 2,
      name: /Won!$/,
    })
    await expect(heading).toBeVisible()
    await expect(dialog).toHaveAccessibleName(
      (await heading.textContent()) ?? "",
    )
    await expect(dialog).toHaveAccessibleDescription(/by resignation/)
    // The heading keeps its look as an h2.
    await expectNoClippedText(dialog)
  })

  test("the status line says who won and how, and nothing about the last move", async ({
    page,
  }) => {
    await startOfflineGame(page, "vs Computer")
    await resignTheGame(page)

    const status = page.getByRole("status").filter({ hasText: /wins/ })
    await expect(status).toHaveText(/^You resigned\. \S+ wins\.$/)
    await expect(status).not.toContainText("moved")
  })
})

test("the phone eval bar is a picture with the advantage in words", async ({
  page,
}) => {
  await startOfflineGame(page, "vs Computer")
  await playMove(page, "c5", "d5")
  await expect(moveList(page)).toHaveCount(2, { timeout: 30_000 })

  const bar = page.getByRole("img", {
    name: /^Position: (even|(Black|White) ahead by \d+\.\d)$/,
  })
  await expect(bar).toBeVisible()
  // The figure drawn on the bar is the label's number, and is not read twice.
  const figure = bar.locator("span", { hasText: /^\d+\.\d$/ })
  await expect(figure).toHaveAttribute("aria-hidden", "true")
})
