import { readFileSync } from "node:fs"
import type { Locator, Page } from "@playwright/test"
import { expect, test } from "@playwright/test"
import { openApp, startOfflineGame, startOnlineGame } from "./support/app"
import { moveList, playMove, selectSquare } from "./support/board"

// On a phone the board is the game, so nothing else on the game screen may
// take its room. The first-game guide used to sit under the scoreboard as a
// full card, and the panel's floor shrank the board to about half its width to
// make space for it. Then it was a one-line bar in the move history's slot,
// which cut every step's title and hid its text. A step's whole title and text
// need about twice the height that slot has on a short phone, and every pixel
// of it would come out of the board, so a phone shows no guide at all (TUD-1127,
// the board's call). The move history keeps a reserved height of at least one
// row, and the move it marks as current is never cut off by the card around it.
// All of it fits a 375×667 screen without the page scrolling.
//
// A desktop keeps the full guide card in the side panel, as it was.
//
// No service worker: see first-game-guide.spec.ts.
test.use({ serviceWorkers: "block" })

// 402×874 is an iPhone 16 Pro, and 402×750 and 390×700 are what Safari's
// toolbars leave of an iPhone screen. Safari also lays the page under the status
// bar, which these browsers do not, so a 402pt-wide iPhone in Safari has the
// board and panel of 402×710 here. 390×700 and 402×710 are short enough for the
// single-line move strip, the layout that left height over: on a real iPhone it
// all went under the actions (TUD-1127). The other sizes have room for the list.
const PHONES = [
  { width: 375, height: 667 },
  { width: 390, height: 700 },
  { width: 402, height: 710 },
  { width: 402, height: 750 },
  { width: 390, height: 844 },
  { width: 402, height: 874 },
  { width: 430, height: 932 },
]
const DESKTOP = { width: 1440, height: 900 }

/** Whether each game start the page sends from now on says it was guided. */
function recordGuidedStarts(page: Page): unknown[] {
  const guided: unknown[] = []
  page.on("request", (request) => {
    if (request.method() !== "POST") return
    if (!request.url().endsWith("/api/v1/events/game")) return
    const event = JSON.parse(request.postData() ?? "{}") as {
      kind?: string
      guided?: unknown
    }
    if (event.kind === "start") guided.push(event.guided)
  })
  return guided
}

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

/** Plays your move against the computer and waits for its answer. */
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

/** A longer game, for a history that holds more than the card shows even on
 * the widest phone. No position comes twice, so it never ends in a draw. */
const LONG_BLACK_MOVES: [string, string][] = [
  ...BLACK_MOVES,
  ["b4", "c4"],
  ["b3", "c3"],
  ["a5", "b5"],
  ["d5", "e5"],
  ["d4", "e4"],
  ["d3", "e3"],
  ["c6", "d6"],
]

/** White's answers to LONG_BLACK_MOVES, the board turned half a turn. */
const LONG_WHITE_MOVES: [string, string][] = [
  ["g5", "f5"],
  ["g6", "f6"],
  ["g7", "f7"],
  ["h4", "g4"],
  ["h5", "g5"],
  ["h6", "g6"],
  ["h7", "g7"],
  ["i5", "h5"],
  ["f6", "e6"],
  ["f7", "e7"],
  ["g4", "f4"],
  ["g6", "f6"],
]

/** The space around and between the cards of the panel under the board, in px. */
type PanelSpacing = {
  /** From the top of the panel to the top of the scoreboard card. */
  above: number
  /** From the bottom of the actions card to the bottom of the screen. */
  below: number
  /**
   * Every gap down the column, top to bottom: scoreboard card, the history
   * card (or the guide bar in its slot), the ‹ › step row when the layout
   * shows it, and the actions card.
   */
  between: number[]
}

/**
 * Measures the phone's panel: the scoreboard card is the first painted box in
 * it, the middle card is the history (or the guide bar standing in its slot),
 * the step row is the box holding the previous-move button (only in the
 * roomier layout), and the actions card is the box holding Resign. The
 * safe-area inset is zero in these browsers, so the bottom of the screen is
 * the safe-area edge.
 */
async function panelSpacing(page: Page): Promise<PanelSpacing> {
  const middle = page
    .getByRole("region", { name: /^(Moves|How to move)$/ })
    .filter({ visible: true })
    .first()
  const middleBox = await middle.boundingBox()
  const stepRow = page
    .getByRole("button", { name: "Go to previous move" })
    .filter({ visible: true })
    .locator("..")
  const stepRowBox =
    (await stepRow.count()) > 0
      ? await stepRow.first().boundingBox()
      : null
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
  const column = [middleBox, stepRowBox, actionsBox].filter(
    (box) => box !== null,
  )
  const between = [column[0].y - panel.scoreBottom]
  for (let index = 1; index < column.length; index += 1) {
    const upper = column[index - 1]
    between.push(column[index].y - (upper.y + upper.height))
  }
  return {
    above: panel.scoreTop - panel.top,
    below: panel.screenBottom - (actionsBox.y + actionsBox.height),
    between,
  }
}

/**
 * TUD-1107 (board): the panel's cards sit evenly in it. The space above the
 * scoreboard and below the actions differ by 4px at most, and every gap
 * between the boxes of the column is the same.
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
      Math.max(...spacing.between) - Math.min(...spacing.between),
      `${measured}; the gaps between the cards`,
    ).toBeLessThanOrEqual(1)
  }).toPass({ timeout: 10_000 })
}

for (const viewport of PHONES) {
  test.describe(`at ${viewport.width}×${viewport.height}`, () => {
    test.use({ viewport })

    // TUD-1107 and TUD-1127: whatever height the panel has left over is
    // shared above the scoreboard and below the actions, not left at the
    // bottom.
    test("the panel under the board is spaced evenly above, below and between its cards", async ({
      page,
    }) => {
      await startOfflineGame(page, "vs Computer")
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

    test("older moves out of view are shown as more, and a swipe brings them back", async ({
      page,
    }) => {
      // Both sides are played by the test: the computer picks its moves at
      // random, and one that lands in the way makes a scripted move illegal.
      await startOfflineGame(page, "Pass & Play")
      for (const [index, black] of LONG_BLACK_MOVES.entries()) {
        await playMove(page, black[0], black[1])
        await playMove(
          page,
          LONG_WHITE_MOVES[index][0],
          LONG_WHITE_MOVES[index][1],
        )
        await expect(moveList(page)).toHaveCount(2 * (index + 1))
      }
      await expectNewestMoveShown(page, 2 * LONG_BLACK_MOVES.length)

      // At the newest move: older moves are past the start edge, which fades;
      // nothing is past the end.
      const start = history(page).getByRole("button", { name: "Start" })
      expect(await clippedBy(start), "Start is out of view").not.toEqual(
        [],
      )
      await expect.poll(() => edgeFadeShows(page, "start")).toBe(true)
      await expect.poll(() => edgeFadeShows(page, "end")).toBe(false)

      // A swipe back over the card reaches the start of the game. Mobile
      // WebKit has no mouse wheel, so scroll the box itself: the same scroll
      // events a swipe fires.
      await history(page)
        .locator(".strip-scroll, .panel-scroll")
        .filter({ visible: true })
        .first()
        .evaluate((box) => box.scrollBy({ left: -10_000, top: -10_000 }))
      await expectShownInFull(start, "the Start of the record")
      await expect.poll(() => edgeFadeShows(page, "start")).toBe(false)
      await expect.poll(() => edgeFadeShows(page, "end")).toBe(true)
      await expectNoPageScroll(page)

      // Swiped away from the newest move, the next one still brings the card
      // back to it: a new move is always shown, wherever the reader was.
      const moves = 2 * LONG_BLACK_MOVES.length
      await playMove(page, "a4", "b4")
      await expectNewestMoveShown(page, moves + 1)
      await playMove(page, "i6", "h6")
      await expectNewestMoveShown(page, moves + 2)
      await expect.poll(() => edgeFadeShows(page, "end")).toBe(false)
    })

    // TUD-1127: the guide cut to one line ("Push 6 off to ...") taught
    // nothing, and the whole of it does not fit a short phone without taking
    // the board's room. A first game on a phone opens with no guide, no way
    // to call it up, and is not counted as guided.
    test("a first game shows no guide, and the board has its full room", async ({
      page,
    }) => {
      const guidedStarts = recordGuidedStarts(page)
      await startOfflineGame(page, "vs Computer")
      await expect.poll(() => guidedStarts).toEqual([false])
      // The board takes input by now, so the guide had its chance to show.
      await selectSquare(page, "c5")
      await expect(guide(page)).toHaveCount(0)
      await expect(
        page.getByRole("button", { name: "How to move" }),
        "the ? that calls the guide up",
      ).toHaveCount(0)
      await expect(history(page)).toBeVisible()
      await expectActionsInView(page)
      await expectNoPageScroll(page)
    })

    test("the move history keeps a full row and never cuts the current move", async ({
      page,
    }) => {
      await startOfflineGame(page, "Pass & Play")

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
    await expect(guide(page)).toContainText(
      "Tap up to three marbles in a line.",
    )
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

type GuideCopy = Record<string, string>

/** The guide's copy in one language, read from the app's own strings. */
function guideCopy(language: "en" | "pt"): GuideCopy {
  const path = `apps/game/src/i18n/locales/${language}/game.json`
  return JSON.parse(readFileSync(path, "utf8")).guide
}

/** The game screen's own labels in one language, for starting a game. */
function controlsCopy(language: "en" | "pt"): Record<string, string> {
  const path = `apps/game/src/i18n/locales/${language}/game.json`
  return JSON.parse(readFileSync(path, "utf8")).controls
}

/**
 * The text is all there and all shown: nothing in the element is cut to an
 * ellipsis or clamped to fewer lines than it needs.
 */
async function expectWholeText(
  locator: Locator,
  text: string,
  what: string,
) {
  await expect(locator, what).toHaveText(text)
  const cut = await locator.evaluate(
    (element) =>
      element.scrollWidth > element.clientWidth + 0.5 ||
      element.scrollHeight > element.clientHeight + 0.5,
  )
  expect(cut, `${what} is cut short`).toBe(false)
}

// TUD-1127: every step of the desktop guide shows its whole title and text, in
// English and in Portuguese, the longest of the three titles.
for (const language of ["en", "pt"] as const) {
  test(`at 1440×900 each guide step shows its whole title and text in ${language}`, async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP)
    await page.addInitScript((code) => {
      localStorage.setItem("abalone_language", code)
    }, language)
    const copy = guideCopy(language)
    const controls = controlsCopy(language)
    await openApp(page, "/offline")
    await page.getByRole("tab", { name: controls.mode_ai }).click()
    await page
      .getByRole("button", { name: controls.play_button, exact: true })
      .click()

    const panel = page.getByRole("region", { name: copy.title })
    const steps: [string, () => Promise<void>][] = [
      ["select", async () => {}],
      ["direction", () => selectSquare(page, "c5")],
      ["win", () => playMove(page, "c5", "d5")],
    ]
    for (const [step, reach] of steps) {
      await reach()
      await expectWholeText(
        panel.getByRole("heading"),
        copy[`${step}_title`],
        `the ${step} step's title`,
      )
      //the last step's title is the whole rule and has no text under it
      const body = copy[`${step}_body`]
      if (body === undefined) continue
      await expectWholeText(
        panel.getByText(body, { exact: true }),
        body,
        `the ${step} step's text`,
      )
    }
  })
}

// TUD-1127 QA: a phone held sideways has the panel beside the board, and it is
// taller than the screen there. Sharing the spare height evenly must not share
// a shortfall: the scoreboard stays whole at the top of the panel, under the
// header, as it is on main.
test("at 844×390 the panel beside the board starts with its scoreboard whole", async ({
  page,
}) => {
  await page.setViewportSize({ width: 844, height: 390 })
  await startOfflineGame(page, "vs Computer")
  await expect(guide(page)).toBeVisible()
  const placement = await page
    .locator("aside")
    .filter({ visible: true })
    .first()
    .evaluate((aside) => {
      const isClear = (colour: string) =>
        colour === "transparent" || /,\s*0\)$/.test(colour)
      const score = Array.from(aside.querySelectorAll("*")).find(
        (element) => !isClear(getComputedStyle(element).backgroundColor),
      )
      return {
        asideTop: aside.getBoundingClientRect().top,
        scoreTop: score?.getBoundingClientRect().top ?? Number.NaN,
      }
    })
  expect(
    placement.scoreTop,
    `the scoreboard's top against the panel's: ${JSON.stringify(placement)}`,
  ).toBeGreaterThanOrEqual(placement.asideTop - 0.5)
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

// TUD-1138: the online board's panel shares its spare height the same way as
// the offline one. Its seat card is taller, so the single-line move strip
// starts at a shorter phone: 375×667 has height left over, while at 390×700 and
// 402×710 the list fills the column and this guards that it stays even.
for (const viewport of PHONES.slice(0, 3)) {
  test(`at ${viewport.width}×${viewport.height} an online game's panel shares its spare height above and below its cards`, async ({
    browser,
  }) => {
    test.slow(
      browser.browserType().name() === "webkit",
      "two WebKit pages paint in software",
    )

    const { host, guest, hostPage, guestPage } =
      await startOnlineGame(browser)
    try {
      await hostPage.setViewportSize(viewport)
      await playMove(hostPage, "c5", "d5")
      await playMove(guestPage, "g5", "f5")
      await expect(movePills(hostPage)).toHaveCount(2, { timeout: 30_000 })

      await expect(async () => {
        const spacing = await panelSpacing(hostPage)
        expect(
          Math.abs(spacing.above - spacing.below),
          `spacing in px: ${JSON.stringify(spacing)}; above vs below the cards`,
        ).toBeLessThanOrEqual(4)
      }).toPass({ timeout: 10_000 })
      await expectNoPageScroll(hostPage)
    } finally {
      await host.close()
      await guest.close()
    }
  })
}

// The same check online: sideways, the panel beside the board is taller than
// the screen, and sharing the spare height must not share that shortfall.
test("at 844×390 an online game's panel beside the board starts with its seat card whole", async ({
  browser,
}) => {
  test.slow(
    browser.browserType().name() === "webkit",
    "two WebKit pages paint in software",
  )

  const { host, guest, hostPage } = await startOnlineGame(browser)
  try {
    await hostPage.setViewportSize({ width: 844, height: 390 })
    await expect(
      hostPage.getByRole("button", { name: "Resign" }),
    ).toBeAttached()
    await expect(async () => {
      const placement = await hostPage
        .locator("aside")
        .filter({ visible: true })
        .first()
        .evaluate((aside) => {
          const isClear = (colour: string) =>
            colour === "transparent" || /,\s*0\)$/.test(colour)
          const seat = Array.from(aside.querySelectorAll("*")).find(
            (element) =>
              !isClear(getComputedStyle(element).backgroundColor),
          )
          return {
            asideTop: aside.getBoundingClientRect().top,
            seatTop: seat?.getBoundingClientRect().top ?? Number.NaN,
          }
        })
      expect(
        placement.seatTop,
        `the seat card's top against the panel's: ${JSON.stringify(placement)}`,
      ).toBeGreaterThanOrEqual(placement.asideTop - 0.5)
    }).toPass({ timeout: 10_000 })
  } finally {
    await host.close()
    await guest.close()
  }
})
