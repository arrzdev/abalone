import type { Locator, Page } from "@playwright/test"
import { expect, test } from "@playwright/test"
import { startOfflineGame, startOnlineGame } from "./support/app"
import { playMove } from "./support/board"

// On a phone the board is the game, so nothing else on the game screen may
// take its room. The first-game guide used to sit under the scoreboard as a
// full card, and the panel's floor shrank the board to about half its width to
// make space for it. On a phone the guide is now a compact step bar in the
// move history's slot: the board keeps its size, the bar fits in the space the
// history had. The move history itself keeps a reserved height of at least one
// row, and the move it marks as current is never cut off by the card around it.
// All of it fits a 375×667 screen without the page scrolling.
//
// A desktop keeps the full guide card in the side panel, as it was.
//
// No service worker: see first-game-guide.spec.ts.
test.use({ serviceWorkers: "block" })

const PHONES = [
  { width: 375, height: 667 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
]
const DESKTOP = { width: 1440, height: 900 }

/** One move row: a 28px pill (20px of text, 4px above and below it). */
const MOVE_ROW = 28
/** The history card's own padding, top and bottom. */
const CARD_PADDING = 4

function guide(page: Page) {
  return page.getByRole("region", { name: "How to move" })
}

/** The move history card: the list, or the strip of chips on a short panel. */
function history(page: Page) {
  return page
    .getByRole("region", { name: "Moves" })
    .filter({ visible: true })
}

function boardCanvas(page: Page) {
  return page
    .locator(".game-canvas-wrapper canvas")
    .filter({ visible: true })
    .first()
}

/**
 * The board's width once it has stopped resizing: two reads 250ms apart that
 * agree. The board letterboxes into its box on the next frame after the panel
 * changes, so a single read straight after a change can be the old size.
 */
async function settledBoardWidth(page: Page): Promise<number> {
  let last = -1
  let width = 0
  await expect(async () => {
    const box = await boardCanvas(page).boundingBox()
    expect(box).not.toBeNull()
    width = box?.width ?? 0
    const previous = last
    last = width
    expect(
      Math.abs(width - previous),
      "board still resizing",
    ).toBeLessThan(1)
  }).toPass({ intervals: [250], timeout: 10_000 })
  return width
}

/**
 * Every box that cuts part of the element off: the viewport, and each ancestor
 * that clips its overflow and does not hold the whole element. Empty when the
 * element is shown in full.
 */
function clippedBy(locator: Locator): Promise<string[]> {
  return locator.evaluate((element) => {
    const box = element.getBoundingClientRect()
    const holds = (outer: {
      left: number
      top: number
      right: number
      bottom: number
    }) =>
      box.left >= outer.left - 0.5 &&
      box.top >= outer.top - 0.5 &&
      box.right <= outer.right + 0.5 &&
      box.bottom <= outer.bottom + 0.5
    const clips: string[] = []
    if (
      !holds({ left: 0, top: 0, right: innerWidth, bottom: innerHeight })
    )
      clips.push("the viewport")
    for (
      let parent = element.parentElement;
      parent !== null;
      parent = parent.parentElement
    ) {
      const style = getComputedStyle(parent)
      if (style.overflowX === "visible" && style.overflowY === "visible")
        continue
      if (!holds(parent.getBoundingClientRect()))
        clips.push(
          `<${parent.tagName.toLowerCase()} class="${parent.className}">`,
        )
    }
    return clips
  })
}

async function expectShownInFull(locator: Locator, what: string) {
  await expect
    .poll(() => clippedBy(locator), { message: `${what} is cut off by` })
    .toEqual([])
}

/** The page itself never scrolls: the game screen fits the viewport. */
async function expectNoPageScroll(page: Page) {
  const overflow = await page.evaluate(() => {
    const root = document.scrollingElement ?? document.documentElement
    return root.scrollHeight - innerHeight
  })
  expect(
    overflow,
    "px the page is taller than the viewport",
  ).toBeLessThanOrEqual(0)
}

/** The panel's actions are all on screen, whole. */
async function expectActionsInView(page: Page) {
  await expectShownInFull(
    page.getByRole("button", { name: "Resign" }),
    "the Resign action",
  )
  await expectShownInFull(
    page.getByRole("button", { name: "Undo" }),
    "the Undo action",
  )
}

/**
 * The history card holds at least one full row, and the move it marks as
 * current is shown whole: not cut at the bottom by the card or the panel.
 */
async function expectHistoryRowInFull(page: Page) {
  const card = history(page)
  await expect(card).toBeVisible()
  const current = card.locator('[aria-current="true"]')
  await expect(current).toHaveCount(1)
  await expectShownInFull(current, "the current move")
  await expectShownInFull(card, "the move history")

  const cardBox = await card.boundingBox()
  const pillBox = await current.boundingBox()
  expect(cardBox).not.toBeNull()
  expect(pillBox).not.toBeNull()
  if (cardBox === null || pillBox === null) return
  expect(
    cardBox.height,
    "the history card's height in px: one move row and its padding",
  ).toBeGreaterThanOrEqual(pillBox.height + 2 * CARD_PADDING - 0.5)
}

for (const viewport of PHONES) {
  test.describe(`at ${viewport.width}×${viewport.height}`, () => {
    test.use({ viewport })

    test("the guide keeps the board at 90% of its size or more and fits on screen", async ({
      page,
    }) => {
      await startOfflineGame(page, "vs Computer")
      await expect(guide(page)).toContainText("Step 1 of 3")
      const withGuide = await settledBoardWidth(page)

      // The bar keeps the guide's content and its two ways on.
      await expect(guide(page)).toContainText("Pick your marbles")
      await expectShownInFull(guide(page), "the guide")
      await expectShownInFull(
        guide(page).getByRole("button", { name: "Skip" }),
        "Skip",
      )
      await expectShownInFull(
        guide(page).getByRole("button", { name: "Next" }),
        "Next",
      )
      await expectActionsInView(page)
      await expectNoPageScroll(page)

      await guide(page).getByRole("button", { name: "Skip" }).click()
      await expect(guide(page)).toHaveCount(0)
      const withoutGuide = await settledBoardWidth(page)

      expect(
        withGuide / withoutGuide,
        `board width with the guide (${withGuide}px) over without it (${withoutGuide}px)`,
      ).toBeGreaterThanOrEqual(0.9)
    })

    test("the move history keeps a full row and never cuts the current move", async ({
      page,
    }) => {
      await startOfflineGame(page, "Pass & Play")
      await guide(page).getByRole("button", { name: "Skip" }).click()
      await expect(guide(page)).toHaveCount(0)

      // Before any move the card still holds its row.
      const empty = await history(page).boundingBox()
      expect(empty).not.toBeNull()
      expect(
        empty?.height ?? 0,
        "the empty history card's height in px",
      ).toBeGreaterThanOrEqual(MOVE_ROW + 2 * CARD_PADDING - 0.5)

      await playMove(page, "c5", "d5")
      await expectHistoryRowInFull(page)
      await playMove(page, "g5", "f5")
      await playMove(page, "c4", "d4")
      await playMove(page, "g6", "f6")
      await playMove(page, "c3", "d3")
      await playMove(page, "g7", "f7")
      await expectHistoryRowInFull(page)

      await expectActionsInView(page)
      await expectNoPageScroll(page)
    })
  })
}

test.describe("at 1440×900", () => {
  test.use({ viewport: DESKTOP })

  // The desktop guide stays the full card beside the board, and the board does
  // not change size for it.
  test("the guide stays the full card and the board keeps its size", async ({
    page,
  }) => {
    await startOfflineGame(page, "vs Computer")
    await expect(guide(page)).toContainText("Step 1 of 3")
    await expect(guide(page)).toContainText("Pick your marbles")
    await expect(guide(page)).toContainText("Tap one of your marbles.")
    await expect(
      page.locator("aside").getByRole("region", { name: "How to move" }),
    ).toBeVisible()
    const withGuide = await settledBoardWidth(page)

    await guide(page).getByRole("button", { name: "Skip" }).click()
    await expect(guide(page)).toHaveCount(0)
    await expect(history(page)).toBeVisible()
    const withoutGuide = await settledBoardWidth(page)

    expect(
      Math.abs(withGuide - withoutGuide),
      "px the board changed",
    ).toBeLessThan(1)
    await expectNoPageScroll(page)
  })
})

// Online games share the panel: the same history card under the same rules on
// the smallest phone.
test("at 375×667 an online game's history keeps a full row and the page does not scroll", async ({
  browser,
}) => {
  const { host, guest, hostPage, guestPage } =
    await startOnlineGame(browser)
  try {
    await hostPage.setViewportSize(PHONES[0])
    await playMove(hostPage, "c5", "d5")
    await playMove(guestPage, "g5", "f5")
    await expect(
      history(hostPage).locator('[aria-current="true"]'),
    ).toHaveCount(1)

    await expectHistoryRowInFull(hostPage)
    await expectShownInFull(
      hostPage.getByRole("button", { name: "Resign" }),
      "the Resign action",
    )
    await expectNoPageScroll(hostPage)
  } finally {
    await host.close()
    await guest.close()
  }
})
