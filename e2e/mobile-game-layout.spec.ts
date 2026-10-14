import type { Locator, Page } from "@playwright/test"
import { expect, test } from "@playwright/test"
import { startOfflineGame, startOnlineGame } from "./support/app"
import { moveList, playMove } from "./support/board"

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

/** Every move in the history card, oldest first; "Start" is not one. */
function movePills(page: Page) {
  return history(page)
    .getByRole("button")
    .filter({ has: page.locator(".font-mono") })
}

/** A colour that paints nothing: no fill at all, or a fully clear one. */
function isClear(colour: string): boolean {
  return colour === "transparent" || /,\s*0\)$/.test(colour)
}

/**
 * The newest move is the one marked current, it is lit, and it is shown whole
 * inside the history card: the card scrolled to it by itself.
 */
async function expectNewestMoveShown(page: Page, moves: number) {
  await expect(movePills(page)).toHaveCount(moves, { timeout: 30_000 })
  const newest = movePills(page).last()
  await expect(
    newest,
    "the newest move is the current one",
  ).toHaveAttribute("aria-current", "true")
  await expectShownInFull(newest, `move ${moves}, the newest`)

  const fill = await newest.evaluate(
    (element) => getComputedStyle(element).backgroundColor,
  )
  const cardFill = await history(page).evaluate(
    (element) => getComputedStyle(element).backgroundColor,
  )
  expect(isClear(fill), `the newest move's fill (${fill}) paints`).toBe(
    false,
  )
  expect(fill, "the newest move's fill is not the card's own").not.toBe(
    cardFill,
  )
}

/**
 * The history card's fade at one end (`start` or `end`): whether it shows.
 * Start is the oldest side, end the newest, for the strip and the list alike.
 */
function edgeFadeShows(page: Page, edge: "start" | "end") {
  return history(page)
    .locator(`[data-scroll-edge="${edge}"]`)
    .evaluate((element) => Number(getComputedStyle(element).opacity) > 0.5)
}

/**
 * Plays your move against the computer and waits for its answer. Counted on
 * the page rather than in the card: while the guide is open the card is not
 * shown.
 */
async function playAgainstBot(
  page: Page,
  from: string,
  to: string,
  movesAfter: number,
) {
  await playMove(page, from, to)
  await expect(moveList(page)).toHaveCount(movesAfter, {
    timeout: 30_000,
  })
}

/** Black's moves for a game against the computer: all far from its marbles. */
const BLACK_MOVES: [string, string][] = [
  ["c5", "d5"],
  ["c4", "d4"],
  ["c3", "d3"],
  ["b6", "c6"],
  ["b5", "c5"],
]

/** A longer game, for a history that holds more than the card shows. */
const LONG_BLACK_MOVES: [string, string][] = [
  ...BLACK_MOVES,
  ["b4", "c4"],
  ["b3", "c3"],
  ["a5", "b5"],
]

/** The space around and between the cards of the panel under the board, in px. */
type PanelSpacing = {
  /** From the top of the panel to the top of the scoreboard card. */
  above: number
  /** From the bottom of the actions card to the bottom of the screen. */
  below: number
  /** Scoreboard card to the history card (or the guide bar in its slot). */
  scoreToMiddle: number
  /** The history card (or the guide bar) to the actions card. */
  middleToActions: number
}

/**
 * Measures the phone's panel: the scoreboard card is the first painted box in
 * it, the middle card is the history (or the guide bar standing in its slot),
 * and the actions card is the box holding Resign. The safe-area inset is zero
 * in these browsers, so the bottom of the screen is the safe-area edge.
 */
async function panelSpacing(page: Page): Promise<PanelSpacing> {
  const middle = page
    .getByRole("region", { name: /^(Moves|How to move)$/ })
    .filter({ visible: true })
    .first()
  const middleBox = await middle.boundingBox()
  const actionsBox = await page
    .getByRole("button", { name: "Resign" })
    .locator("..")
    .boundingBox()
  const panel = await page
    .locator("aside")
    .filter({ visible: true })
    .first()
    .evaluate((aside) => {
      const isClear = (colour: string) =>
        colour === "transparent" || /,\s*0\)$/.test(colour)
      const score = Array.from(aside.querySelectorAll("*")).find(
        (element) => !isClear(getComputedStyle(element).backgroundColor),
      )
      const scoreBox = score?.getBoundingClientRect()
      return {
        top: aside.getBoundingClientRect().top,
        scoreTop: scoreBox?.top ?? Number.NaN,
        scoreBottom: scoreBox?.bottom ?? Number.NaN,
        screenBottom: innerHeight,
      }
    })
  expect(middleBox).not.toBeNull()
  expect(actionsBox).not.toBeNull()
  if (middleBox === null || actionsBox === null)
    throw new Error("the panel's cards are not on screen")
  return {
    above: panel.scoreTop - panel.top,
    below: panel.screenBottom - (actionsBox.y + actionsBox.height),
    scoreToMiddle: middleBox.y - panel.scoreBottom,
    middleToActions: actionsBox.y - (middleBox.y + middleBox.height),
  }
}

/**
 * TUD-1107 (board): the panel's cards sit evenly in it. The space above the
 * scoreboard and below the actions differ by 4px at most, and the two gaps
 * between the cards are the same.
 */
async function expectEvenPanelSpacing(page: Page, what: string) {
  await expect(async () => {
    const spacing = await panelSpacing(page)
    const measured = `${what}, spacing in px: ${JSON.stringify(spacing)}`
    expect(
      Math.abs(spacing.above - spacing.below),
      `${measured}; above vs below the cards`,
    ).toBeLessThanOrEqual(4)
    expect(
      Math.abs(spacing.scoreToMiddle - spacing.middleToActions),
      `${measured}; the two gaps between the cards`,
    ).toBeLessThanOrEqual(1)
  }).toPass({ timeout: 10_000 })
}

for (const viewport of PHONES) {
  test.describe(`at ${viewport.width}×${viewport.height}`, () => {
    test.use({ viewport })

    // TUD-1107: against the computer the panel is short enough for the
    // single-line strip, and the newest move ended up cut at its right edge,
    // unlit, with nothing to say that the row scrolls.
    test("the panel under the board is spaced evenly above, below and between its cards", async ({
      page,
    }) => {
      await startOfflineGame(page, "vs Computer")
      await expect(guide(page)).toBeVisible()
      await expectEvenPanelSpacing(page, "with the guide open")

      await guide(page).getByRole("button", { name: "Skip" }).click()
      await expect(guide(page)).toHaveCount(0)
      await expectEvenPanelSpacing(page, "before any move")

      for (const [index, [from, to]] of BLACK_MOVES.slice(0, 2).entries())
        await playAgainstBot(page, from, to, 2 * (index + 1))
      await expectEvenPanelSpacing(page, "after four moves")
      await expectNoPageScroll(page)
    })

    test("against the computer the newest move is always shown whole and lit", async ({
      page,
    }) => {
      await startOfflineGame(page, "vs Computer")
      await guide(page).getByRole("button", { name: "Skip" }).click()
      await expect(guide(page)).toHaveCount(0)

      let moves = 0
      for (const [from, to] of BLACK_MOVES) {
        await playMove(page, from, to)
        moves += 1
        // Yours, straight after you play it.
        await expectNewestMoveShown(page, moves)
        moves += 1
        // The computer's answer.
        await expectNewestMoveShown(page, moves)
      }

      // The TUD-1084 checks hold with a full row of moves.
      await expectHistoryRowInFull(page)
      await expectActionsInView(page)
      await expectNoPageScroll(page)
    })

    test("moves played with the guide open show the newest once it closes", async ({
      page,
    }) => {
      await startOfflineGame(page, "vs Computer")
      await expect(guide(page)).toBeVisible()
      for (const [index, [from, to]] of BLACK_MOVES.entries())
        await playAgainstBot(page, from, to, 2 * (index + 1))

      // The guide gives the history its slot back.
      if ((await guide(page).count()) > 0)
        await guide(page)
          .getByRole("button", { name: /Skip|Got it/ })
          .first()
          .click()
      await expect(guide(page)).toHaveCount(0)

      await expectNewestMoveShown(page, 2 * BLACK_MOVES.length)
      await expectNoPageScroll(page)
    })

    test("older moves out of view are shown as more, and a swipe brings them back", async ({
      page,
    }) => {
      await startOfflineGame(page, "vs Computer")
      await guide(page).getByRole("button", { name: "Skip" }).click()
      for (const [index, [from, to]] of LONG_BLACK_MOVES.entries())
        await playAgainstBot(page, from, to, 2 * (index + 1))
      await expectNewestMoveShown(page, 2 * LONG_BLACK_MOVES.length)

      // At the newest move: older moves are past the start edge, which fades;
      // nothing is past the end.
      const start = history(page).getByRole("button", { name: "Start" })
      expect(await clippedBy(start), "Start is out of view").not.toEqual(
        [],
      )
      await expect.poll(() => edgeFadeShows(page, "start")).toBe(true)
      await expect.poll(() => edgeFadeShows(page, "end")).toBe(false)

      // A swipe back over the card reaches the start of the game.
      const card = await history(page).boundingBox()
      expect(card).not.toBeNull()
      if (card === null) return
      await page.mouse.move(
        card.x + card.width / 2,
        card.y + card.height / 2,
      )
      for (let i = 0; i < 10; i += 1) await page.mouse.wheel(-400, -400)
      await expectShownInFull(start, "the Start of the record")
      await expect.poll(() => edgeFadeShows(page, "start")).toBe(false)
      await expect.poll(() => edgeFadeShows(page, "end")).toBe(true)
      await expectNoPageScroll(page)

      // Swiped away from the newest move, the next one still brings the card
      // back to it: a new move is always shown, wherever the reader was.
      const moves = 2 * LONG_BLACK_MOVES.length
      await playMove(page, "a4", "b4")
      await expectNewestMoveShown(page, moves + 1)
      await expectNewestMoveShown(page, moves + 2)
      await expect.poll(() => edgeFadeShows(page, "end")).toBe(false)
    })

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
  // Two WebKit pages paint in software on a Linux runner: see the same note in
  // online-game.spec.ts (TUD-964).
  test.slow(
    browser.browserType().name() === "webkit",
    "two WebKit pages paint in software",
  )

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

// TUD-1107: a move that arrives from the other player scrolls the history to
// it, the same as a move you play yourself.
test("at 375×667 the other player's move is shown whole and lit when it arrives", async ({
  browser,
}) => {
  test.slow(
    browser.browserType().name() === "webkit",
    "two WebKit pages paint in software",
  )

  const { host, guest, hostPage, guestPage } =
    await startOnlineGame(browser)
  const whiteMoves: [string, string][] = [
    ["g5", "f5"],
    ["g6", "f6"],
    ["g7", "f7"],
    ["h4", "g4"],
  ]
  try {
    await hostPage.setViewportSize(PHONES[0])
    for (const [index, [from, to]] of whiteMoves.entries()) {
      const [blackFrom, blackTo] = BLACK_MOVES[index]
      await playMove(hostPage, blackFrom, blackTo)
      await playMove(guestPage, from, to)
      await expectNewestMoveShown(hostPage, 2 * (index + 1))
    }
    await expectNoPageScroll(hostPage)
  } finally {
    await host.close()
    await guest.close()
  }
})
