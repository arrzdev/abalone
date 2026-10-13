import type { Page } from "@playwright/test"
import { expect, test } from "@playwright/test"
import { openApp } from "./support/app"

// The home page's demo board plays a game on a canvas, and each move is an
// animation loop that redraws the board every frame. Somebody landing on it
// sees the marbles slide as smoothly as the device can draw them. A CSS filter
// on a box around that canvas made WebKit blur the whole board again on every
// frame, and each frame of a move took about three times as long (TUD-958).
//
// What a frame costs depends on the machine and on what else runs on it, so the
// board is timed against itself: as shipped, then with every filter around the
// canvas switched off. Whatever shadow or glow the board has, it must not slow
// the board down.
//
// Between moves the board waits and draws nothing, and those idle frames are
// cheap whatever the page costs to paint. So only the gaps inside the board's
// own loop count: from one of its frames to the next frame that same callback
// asked for.
const SAMPLE_MS = 3_000
const MAX_SLOWDOWN = 1.5

declare global {
  interface Window {
    __animationGaps: number[]
  }
}

/** The middle of the given values. */
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  return (
    sorted[Math.ceil(sorted.length / 2) - 1] ?? Number.POSITIVE_INFINITY
  )
}

/** The gaps between the board's own frames over the next sample window. */
async function sampleBoardFrames(page: Page): Promise<number[]> {
  await page.evaluate(() => {
    window.__animationGaps = []
  })
  await page.waitForTimeout(SAMPLE_MS)
  return page.evaluate(() => window.__animationGaps)
}

test("the home page's demo board paints as fast with its shadow as without", async ({
  page,
}) => {
  // Before the app runs: every frame callback is timed against the frame of
  // the callback that requested it, when there was one.
  await page.addInitScript(() => {
    window.__animationGaps = []
    const request = window.requestAnimationFrame.bind(window)
    let runningFrame: number | null = null
    window.requestAnimationFrame = (callback) => {
      const requestedIn = runningFrame
      return request((now) => {
        if (requestedIn !== null)
          window.__animationGaps.push(now - requestedIn)
        runningFrame = now
        try {
          callback(now)
        } finally {
          runningFrame = null
        }
      })
    }
  })
  await openApp(page, "/")
  const board = page.locator("main canvas").first()
  await expect(board).toBeVisible()

  // The board is playing once its loop has drawn two frames in a row.
  await expect
    .poll(() => page.evaluate(() => window.__animationGaps.length), {
      message: "the demo board started a move",
      timeout: 30_000,
    })
    .toBeGreaterThan(0)

  const shipped = await sampleBoardFrames(page)
  await board.evaluate((canvas) => {
    for (let box = canvas.parentElement; box; box = box.parentElement)
      box.style.setProperty("filter", "none", "important")
  })
  const unfiltered = await sampleBoardFrames(page)

  const summary = [
    `as shipped: ${shipped.length} board frames, median gap ${median(shipped).toFixed(0)} ms`,
    `without filters: ${unfiltered.length} board frames, median gap ${median(unfiltered).toFixed(0)} ms`,
  ].join("; ")
  expect(unfiltered.length, summary).toBeGreaterThan(0)
  expect(median(shipped), summary).toBeLessThanOrEqual(
    median(unfiltered) * MAX_SLOWDOWN,
  )
})
