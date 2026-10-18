import { expect, test } from "@playwright/test"
import { openApp, signUp, uniqueUsername } from "./support/app"

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
    // Signed out, /online opens the sign-in dialog, and an open dialog keeps
    // focus inside itself (dialog-focus.spec.ts); the page is for players.
    if (path === "/online") await signUp(page, uniqueUsername("skip"))
    await openApp(page, path)
    // The hub has nothing to Tab to until the account's games load.
    if (path === "/online")
      await expect(
        page.getByRole("heading", { name: "Nothing here yet" }),
      ).toBeVisible()

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
