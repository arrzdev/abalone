import type { Locator, Page } from "@playwright/test"
import { expect, test } from "@playwright/test"
import { openApp } from "./support/app"

// The home page's demo board plays a game by itself, forever, while it is on
// screen. Moving content that starts on its own and runs past five seconds needs
// a way to stop it (WCAG 2.2.2), and someone whose system asks for less motion
// should not get it at all until they ask for it.
//
// The canvas says nothing a test can read about the frames it draws, but its
// accessible name is the position, and that names the last move. A board that
// is playing changes it every couple of seconds; a board that holds still keeps
// it.

/** Long enough for a playing board to have made at least one move. */
const STILL_FOR_MS = 4_000

/** How often the label is read while the board is meant to hold still. */
const SAMPLE_MS = 250

/** Lets a move already under way when Pause is pressed finish landing. */
const LANDING_MS = 2_000

/** How long a playing board may take to make its next move. */
const NEXT_MOVE_MS = 10_000

const TAP_TARGET = 44

function demoBoard(page: Page): Locator {
  return page.locator("main canvas").first()
}

async function label(board: Locator): Promise<string> {
  return (await board.getAttribute("aria-label")) ?? ""
}

/** Reads the label for `STILL_FOR_MS` and fails on the first change. */
async function expectStill(board: Locator, page: Page): Promise<void> {
  const before = await label(board)
  for (let elapsed = 0; elapsed < STILL_FOR_MS; elapsed += SAMPLE_MS) {
    await page.waitForTimeout(SAMPLE_MS)
    expect(await label(board), `the board moved after ${elapsed} ms`).toBe(
      before,
    )
  }
}

/** Waits for the label to change from what it is now. */
async function expectNextMove(board: Locator): Promise<void> {
  const before = await label(board)
  await expect
    .poll(() => label(board), {
      message: "the board makes its next move",
      timeout: NEXT_MOVE_MS,
    })
    .not.toBe(before)
}

async function expectTapTarget(button: Locator): Promise<void> {
  const box = await button.boundingBox()
  if (box === null) throw new Error("the button has no box")
  expect(box.width, "tap target width").toBeGreaterThanOrEqual(TAP_TARGET)
  expect(box.height, "tap target height").toBeGreaterThanOrEqual(
    TAP_TARGET,
  )
}

test.describe("the home page's demo board", () => {
  test("holds still for someone whose system asks for less motion, until they press Play", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" })
    await openApp(page, "/")
    const board = demoBoard(page)
    await expect(board).toBeVisible()

    await expectStill(board, page)

    const play = page.getByRole("button", { name: "Play demo" })
    await expect(play, "the board starts paused").toBeVisible()
    await expect(
      page.getByRole("button", { name: "Pause demo" }),
    ).toHaveCount(0)
    await expectTapTarget(play)

    await play.click()
    await expect(
      page.getByRole("button", { name: "Pause demo" }),
    ).toBeVisible()
    await expectNextMove(board)
  })

  test("plays by itself, stops on Pause and picks up again on Play", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" })
    await openApp(page, "/")
    const board = demoBoard(page)
    await expect(board).toBeVisible()
    await expectNextMove(board)

    const pause = page.getByRole("button", { name: "Pause demo" })
    await expect(pause).toBeVisible()
    await expectTapTarget(pause)

    await pause.click()
    const play = page.getByRole("button", { name: "Play demo" })
    await expect(play).toBeVisible()
    await expectTapTarget(play)
    await page.waitForTimeout(LANDING_MS)
    await expectStill(board, page)

    await play.click()
    await expect(pause).toBeVisible()
    await expectNextMove(board)
  })
})

// The canvas is empty until the page's script has run and drawn it, so the slot
// it will fill holds the opening position as markup until then.
test.describe("the demo board before the script has run", () => {
  const PHONE = { width: 390, height: 664 }

  /** The 61 squares, and a shadow and a marble for each of the 28 marbles. */
  const SQUARES = 61
  const MARBLES = 28

  const frame = (page: Page): Locator =>
    page.locator("main svg[data-demo-board-frame]")

  test.describe("with JavaScript off", () => {
    test.use({ javaScriptEnabled: false, viewport: PHONE })

    test("the slot shows the opening position, not an empty box", async ({
      page,
    }) => {
      await page.goto("/")
      await expect(frame(page)).toBeVisible()
      await expect(frame(page).locator("circle")).toHaveCount(
        SQUARES + MARBLES * 2,
      )
      const box = await frame(page).boundingBox()
      expect(box?.width, "the frame has a width").toBeGreaterThan(100)
      expect(box?.height, "the frame has a height").toBeGreaterThan(100)
    })
  })

  test.describe("with JavaScript on", () => {
    test.use({ viewport: PHONE })

    test("the canvas takes the frame's place without moving the board", async ({
      browser,
      page,
    }) => {
      //the frame's box is the slot the canvas letterboxes the board into
      const bare = await browser.newContext({
        javaScriptEnabled: false,
        viewport: PHONE,
      })
      const barePage = await bare.newPage()
      await barePage.goto("/")
      const slot = await frame(barePage).boundingBox()
      await bare.close()
      if (slot === null) throw new Error("the frame has no box")

      await openApp(page, "/")
      const canvas = demoBoard(page)
      await expect(canvas).toBeVisible()
      await expect(
        frame(page),
        "the frame is gone once drawn",
      ).toHaveCount(0)
      const drawn = await canvas.boundingBox()
      if (drawn === null) throw new Error("the canvas has no box")

      //whole pixels: the canvas is floored to a whole size, the frame is not
      expect(drawn.x + drawn.width / 2).toBeCloseTo(
        slot.x + slot.width / 2,
        0,
      )
      expect(drawn.y + drawn.height / 2).toBeCloseTo(
        slot.y + slot.height / 2,
        0,
      )
      expect(drawn.width).toBeLessThanOrEqual(slot.width + 1)
      expect(drawn.height).toBeLessThanOrEqual(slot.height + 1)
    })
  })
})
