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
// cheap whatever the page costs to paint. Other loops on the page are cheap
// too, and they run in the same frames. So only the gaps inside the board's own
// loop count: from a frame that painted the board to the next frame that same
// callback asked for, when that one painted the board as well.
//
// The first seconds after load are slower whatever the page draws (shaders,
// textures, the bot list loading), so they are thrown away. Then the board is
// timed in turns, shipped and unfiltered, starting and ending shipped: a page
// that slows down or speeds up over the test weighs on both sides alike.
//
// A loaded WebKit draws only a few board frames a second, and a median of a
// handful of gaps is noise. So each turn lasts until the board has drawn a set
// number of frames, not a set time.
const WARM_UP_MS = 2_000
const FRAMES_PER_TURN = 10
const UNFILTERED_TURNS = 3
const MAX_SLOWDOWN = 1.3

declare global {
  interface Window {
    __animationGaps: number[]
    __boardCanvas: HTMLCanvasElement | null
  }
}

/** The middle of the given values. */
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  return (
    sorted[Math.ceil(sorted.length / 2) - 1] ?? Number.POSITIVE_INFINITY
  )
}

/** The gaps between the board's next frames, once it has drawn a turn's worth. */
async function sampleBoardFrames(page: Page): Promise<number[]> {
  await page.evaluate(() => {
    window.__animationGaps = []
  })
  await page.waitForFunction(
    (frames) => window.__animationGaps.length >= frames,
    FRAMES_PER_TURN,
    { timeout: 20_000 },
  )
  return page.evaluate(() => window.__animationGaps)
}

/** Switches every filter around the board off, or back to the page's own. */
async function setAncestorFilters(page: Page, value: "none" | null) {
  await page.evaluate((filter) => {
    const canvas = window.__boardCanvas
    for (let box = canvas?.parentElement; box; box = box.parentElement) {
      if (filter) box.style.setProperty("filter", filter, "important")
      else box.style.removeProperty("filter")
    }
  }, value)
}

test("the home page's demo board paints as fast with its shadow as without", async ({
  page,
}) => {
  test.setTimeout(150_000)
  // Before the app runs: every frame callback notes the canvas it painted, and
  // is timed against the frame of the callback that requested it when both
  // painted the same canvas. That canvas is the board.
  await page.addInitScript(() => {
    type Frame = { time: number; painted: HTMLCanvasElement | null }
    window.__animationGaps = []
    window.__boardCanvas = null
    let runningFrame: Frame | null = null

    const context =
      CanvasRenderingContext2D.prototype as unknown as Record<
        string,
        (this: CanvasRenderingContext2D, ...args: unknown[]) => unknown
      >
    for (const name of ["clearRect", "drawImage"]) {
      const draw = context[name]
      context[name] = function (...args) {
        if (runningFrame) runningFrame.painted = this.canvas
        return draw.apply(this, args)
      }
    }

    const request = window.requestAnimationFrame.bind(window)
    window.requestAnimationFrame = (callback) => {
      const requestedIn = runningFrame
      return request((now) => {
        const frame: Frame = { time: now, painted: null }
        runningFrame = frame
        try {
          callback(now)
        } finally {
          runningFrame = null
          if (frame.painted && frame.painted === requestedIn?.painted) {
            window.__boardCanvas = frame.painted
            window.__animationGaps.push(now - requestedIn.time)
          }
        }
      })
    }
  })
  await openApp(page, "/")
  await expect(page.locator("main canvas").first()).toBeVisible()

  // The board is playing once its loop has painted two frames in a row.
  await expect
    .poll(() => page.evaluate(() => window.__animationGaps.length), {
      message: "the demo board started a move",
      timeout: 30_000,
    })
    .toBeGreaterThan(0)

  await page.waitForTimeout(WARM_UP_MS)
  const shipped = await sampleBoardFrames(page)
  const unfiltered: number[] = []
  for (let turn = 0; turn < UNFILTERED_TURNS; turn++) {
    await setAncestorFilters(page, "none")
    unfiltered.push(...(await sampleBoardFrames(page)))
    await setAncestorFilters(page, null)
    shipped.push(...(await sampleBoardFrames(page)))
  }

  const summary = [
    `as shipped: ${shipped.length} board frames, median gap ${median(shipped).toFixed(0)} ms`,
    `without filters: ${unfiltered.length} board frames, median gap ${median(unfiltered).toFixed(0)} ms`,
  ].join("; ")
  expect(median(shipped), summary).toBeLessThanOrEqual(
    median(unfiltered) * MAX_SLOWDOWN,
  )
})
