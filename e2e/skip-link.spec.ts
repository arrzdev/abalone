import { expect, test } from "@playwright/test"
import { openApp } from "./support/app"

// A keyboard user reaches the page without walking the header: the first Tab
// on every page offers "Skip to content", it shows while focused, and pressing
// it moves focus into <main>, so the next Tab is the page's own first control.

// Tab only means something with a keyboard; the phone project has none.
test.skip(({ isMobile }) => isMobile, "keyboard focus is a desktop flow")

for (const path of [
  "/",
  "/rules",
  "/strategy",
  "/opening-moves",
  "/offline",
  "/online",
]) {
  test(`${path}: the first Tab skips the header to the page`, async ({
    page,
  }) => {
    await openApp(page, path)

    await page.keyboard.press("Tab")
    const skipLink = page.getByRole("link", { name: "Skip to content" })
    await expect(skipLink).toBeFocused()
    await expect(skipLink).toBeInViewport()

    await page.keyboard.press("Enter")
    await expect(page.locator("main")).toBeFocused()

    await page.keyboard.press("Tab")
    const insideMain = await page.evaluate(
      () =>
        document.querySelector("main")?.contains(document.activeElement) ??
        false,
    )
    expect(insideMain, "the Tab after the skip lands inside main").toBe(
      true,
    )
  })
}
