import type { Locator, Page } from "@playwright/test"
import { openApp } from "./support/app"
import { expect, test } from "./support/test"

// /offline is the setup screen for a game against the computer, and an indexable
// landing page: it is judged on how soon it looks finished. The board preview
// under the setup tabs is a canvas, which has nothing in it until the page's
// script has run, and it takes its real size at that first draw. Seconds of an
// empty box on a phone, and the box moving when the board arrives.

const PHONE = { width: 375, height: 667 }

/** The 61 squares, and a shadow and a marble for each of the 28 marbles. */
const SQUARES = 61
const MARBLES = 28

const frame = (page: Page): Locator =>
  page.locator("main svg[data-demo-board-frame]")

//the board beside the panel is there too, and hidden: a phone has the preview.
//The other canvases are the marbles in the colour choice, and have no name.
const board = (page: Page): Locator =>
  page.locator("main canvas[aria-label]:visible")

type Shifts = { total: number }

/**
 * Runs in the page before any of its scripts (an init script): sums every
 * layout shift from the first byte on, the ones that follow a press left out.
 */
function watchShifts() {
  const shifts: Shifts = { total: 0 }
  Object.assign(window, { __shifts: shifts })
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries() as (PerformanceEntry & {
      value: number
      hadRecentInput: boolean
    })[])
      if (!entry.hadRecentInput) shifts.total += entry.value
  }).observe({ type: "layout-shift", buffered: true })
}

test.describe("the offline setup screen before the script has run", () => {
  test.describe("with JavaScript off", () => {
    test.use({ javaScriptEnabled: false, viewport: PHONE })

    test("the board preview shows the opening position, not an empty box", async ({
      page,
    }) => {
      await page.goto("/offline")
      await expect(frame(page)).toBeVisible()
      await expect(frame(page).locator("circle")).toHaveCount(
        SQUARES + MARBLES * 2,
      )
      const box = await frame(page).boundingBox()
      expect(box?.width, "the picture has a width").toBeGreaterThan(200)
      expect(box?.height, "the picture has a height").toBeGreaterThan(150)
    })
  })

  test.describe("with JavaScript on", () => {
    test.use({ viewport: PHONE })

    test("nothing shifts from load to the board drawn", async ({
      page,
    }) => {
      await page.addInitScript(watchShifts)
      await openApp(page, "/offline")
      await expect(board(page)).toBeVisible()
      await page.evaluate(() => document.fonts.ready)

      const { total } = await page.evaluate(
        () => (window as unknown as { __shifts: Shifts }).__shifts,
      )
      expect(total, "layout shift from load to the board drawn").toBe(0)
    })

    test("the canvas takes the picture's place without moving the board", async ({
      browser,
      page,
    }) => {
      //the picture's box is the slot the canvas letterboxes the board into
      const bare = await browser.newContext({
        javaScriptEnabled: false,
        viewport: PHONE,
      })
      const barePage = await bare.newPage()
      await barePage.goto("/offline")
      const slot = await frame(barePage).boundingBox()
      await bare.close()
      if (slot === null) throw new Error("the picture has no box")

      await openApp(page, "/offline")
      await expect(board(page)).toBeVisible()
      await expect(
        frame(page),
        "the picture is gone once the board is drawn",
      ).toHaveCount(0)

      const drawn = await board(page).boundingBox()
      if (drawn === null) throw new Error("the canvas has no box")
      //whole pixels: the canvas is floored to a whole size, the picture is not
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

    test("only the portraits on the first screen load eagerly", async ({
      page,
    }) => {
      await openApp(page, "/offline")
      const eagerBelowTheFold = await page.evaluate((fold) => {
        const portraits = [
          ...document.querySelectorAll<HTMLImageElement>(
            "main button[aria-pressed] img",
          ),
        ]
        return {
          count: portraits.length,
          eager: portraits.filter(
            (image) =>
              image.loading !== "lazy" &&
              image.getBoundingClientRect().top >= fold,
          ).length,
        }
      }, PHONE.height)
      expect(eagerBelowTheFold.count, "portraits on the screen").toBe(8)
      expect(
        eagerBelowTheFold.eager,
        "portraits below the fold that load at once",
      ).toBe(0)
    })
  })
})
