import { expect, test } from "@playwright/test"
import { openApp, startOfflineGame } from "./support/app"

// The game lets a reader zoom (allowZoom in nativ.config, WCAG 1.4.4). Pinch zoom
// belongs to the page, and the browser only starts one when the touch-action of
// the element under the fingers and every element above it allows it. So the
// page, and the scroller a reader pinches on, must each allow it. The board is
// the exception: a drag across it is a move, so it keeps every gesture.

/** Whether a computed touch-action value lets a pinch through. */
function allowsPinch(touchAction: string): boolean {
  return (
    touchAction === "auto" ||
    touchAction === "manipulation" ||
    touchAction.split(" ").includes("pinch-zoom")
  )
}

test("the rules page lets a reader pinch zoom on the page and its scroller", async ({
  page,
}) => {
  await openApp(page, "/rules")
  const touchActions = await page.evaluate(() => {
    const scroller = document.querySelector("[data-scroll-view]")
    return {
      html: getComputedStyle(document.documentElement).touchAction,
      body: getComputedStyle(document.body).touchAction,
      scroller: scroller ? getComputedStyle(scroller).touchAction : null,
    }
  })

  for (const [element, touchAction] of Object.entries(touchActions)) {
    expect(touchAction, element).not.toBeNull()
    expect(
      allowsPinch(touchAction ?? ""),
      `${element}: ${touchAction}`,
    ).toBe(true)
  }
})

test("the board keeps every gesture, so a drag across it stays a move", async ({
  page,
}) => {
  await startOfflineGame(page, "Pass & Play")
  const board = page.getByRole("application")
  await expect(board).toHaveCSS("touch-action", "none")
})
