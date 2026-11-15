import { openApp } from "./support/app"
import { expectNoClippedText, waitForRest } from "./support/layout"
import { expect, test } from "./support/test"

// Signed out, `/online` sends a visitor home and asks them to sign in, in a
// sheet over the home page. On a phone the sheet is closed by dragging it down
// or by Escape, and neither is on the screen: it has to carry a Close control,
// the one the desktop dialog has. Closing it, either way, leaves the visitor on
// home with focus on the page's heading, so a screen reader says where they are
// instead of reading from the top of a page it never named.
//
// No service worker: see first-game-guide.spec.ts.
test.use({
  serviceWorkers: "block",
  viewport: { width: 375, height: 667 },
})

const SHEET_NAME = "Sign in to play online"

test("the phone sign-in sheet has a Close control, last in the Tab cycle", async ({
  page,
}) => {
  await openApp(page, "/online")
  const sheet = page.getByRole("dialog", { name: SHEET_NAME })
  await expect(sheet).toBeVisible()

  const close = sheet.getByRole("button", { name: "Close" })
  await expect(close).toBeVisible()
  // Measured where the sheet stops: mid slide, its lower half is still under
  // the screen's edge, which reads as text cut off.
  await waitForRest(sheet)
  // The heading leaves the Close its corner.
  await expectNoClippedText(sheet)
  const box = await close.boundingBox()
  expect(box?.width, "Close is 44 wide").toBeGreaterThanOrEqual(44)
  expect(box?.height, "Close is 44 tall").toBeGreaterThanOrEqual(44)
  // Inside the sheet and on the screen, not under its edge.
  const sheetBox = await sheet.boundingBox()
  expect(box?.x).toBeGreaterThanOrEqual(sheetBox?.x ?? 0)
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(375)

  // The cycle: a step back from the first stop wraps to the last.
  await page.keyboard.press("Tab")
  await page.keyboard.press("Shift+Tab")
  await expect(close).toBeFocused()
  await page.keyboard.press("Tab")
  await expect(close).not.toBeFocused()
})

test("the sign-in sheet draws no focus ring round itself when it opens", async ({
  page,
}) => {
  await openApp(page, "/online")
  const sheet = page.getByRole("dialog", { name: SHEET_NAME })
  await expect(sheet).toBeVisible()
  await waitForRest(sheet)

  // WebKit counts the focus the sheet takes on open as `:focus-visible`, so
  // the keyboard's ring went round the whole sheet for a visitor who tapped.
  const outline = await sheet.evaluate(
    (element) => getComputedStyle(element).outlineStyle,
  )
  expect(outline).toBe("none")
})

test("the sign-in sheet's Close shows its whole focus ring", async ({
  page,
}) => {
  await openApp(page, "/online")
  const sheet = page.getByRole("dialog", { name: SHEET_NAME })
  await expect(sheet).toBeVisible()
  await waitForRest(sheet)

  await page.keyboard.press("Tab")
  await page.keyboard.press("Shift+Tab")
  const close = sheet.getByRole("button", { name: "Close" })
  await expect(close).toBeFocused()

  // How far the ring runs past the boxes that clip it, on its worst side.
  const clipped = await close.evaluate((element) => {
    const style = getComputedStyle(element)
    const reach =
      Number.parseFloat(style.outlineOffset) +
      Number.parseFloat(style.outlineWidth)
    const box = element.getBoundingClientRect()
    let worst = Number.NEGATIVE_INFINITY
    for (
      let ancestor = element.parentElement;
      ancestor !== null;
      ancestor = ancestor.parentElement
    ) {
      const { overflowX, overflowY } = getComputedStyle(ancestor)
      if (overflowX === "visible" && overflowY === "visible") continue
      const frame = ancestor.getBoundingClientRect()
      worst = Math.max(
        worst,
        frame.top - (box.top - reach),
        frame.left - (box.left - reach),
        box.right + reach - frame.right,
        box.bottom + reach - frame.bottom,
      )
    }
    return worst
  })
  expect(clipped, "ring px cut off by a scroller").toBeLessThanOrEqual(0)
})

for (const way of ["Close", "Escape"] as const) {
  test(`${way} closes the sign-in sheet on home with focus on its heading`, async ({
    page,
  }) => {
    await openApp(page, "/online")
    const sheet = page.getByRole("dialog", { name: SHEET_NAME })
    await expect(sheet).toBeVisible()

    if (way === "Close")
      await sheet.getByRole("button", { name: "Close" }).click()
    else await page.keyboard.press("Escape")

    await expect(sheet).toBeHidden()
    expect(new URL(page.url()).pathname).toBe("/")
    await expect(
      page.getByRole("heading", { level: 1 }),
      "focus is on the home heading",
    ).toBeFocused()
    expect(
      await page.evaluate(() => document.activeElement === document.body),
      "focus is not on <body>",
    ).toBe(false)
  })
}
