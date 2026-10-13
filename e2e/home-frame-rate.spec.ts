import { expect, test } from "@playwright/test"
import { openApp } from "./support/app"

// The home page's demo board plays a game on a canvas, and each move is an
// animation loop that redraws the board every frame. A CSS filter on a box
// around that canvas made WebKit blur the whole board again on every frame, and
// each frame of a move took about three times as long (TUD-958). A `blur()` on
// a sibling over the same area is no better in Chromium, which applies the
// filter again wherever the canvas under it changed.
//
// Timing the frames showed that, but a timed test on a loaded machine is a coin
// toss: frames come in whole vsyncs, and one dropped vsync doubles a median. So
// the test checks the cause instead. No element that paints over the board's
// area may carry a filter or a backdrop filter, whatever shadow or glow the
// board has. The shadow itself is pixels on a canvas of its own.
//
// The poster fades in, so a filter is given a few seconds to go away: one that
// is there on the way in and gone after is not one a move paints through.
const SETTLE_MS = 5_000

test("nothing over the home page's demo board is filtered, so a move paints at frame rate", async ({
  page,
}) => {
  await openApp(page, "/")
  const board = page.locator("main canvas").first()
  await expect(board).toBeVisible()

  await expect
    .poll(
      () =>
        board.evaluate((canvas) => {
          const area = canvas.getBoundingClientRect()
          const overlapsBoard = (element: Element) => {
            const box = element.getBoundingClientRect()
            return (
              box.width > 0 &&
              box.height > 0 &&
              box.left < area.right &&
              box.right > area.left &&
              box.top < area.bottom &&
              box.bottom > area.top
            )
          }
          return [...document.querySelectorAll("body *")].flatMap(
            (element) => {
              const style = getComputedStyle(element)
              const filters = [
                style.filter,
                style.backdropFilter,
                style.getPropertyValue("-webkit-backdrop-filter"),
              ].filter((value) => value && value !== "none")
              if (filters.length === 0 || !overlapsBoard(element))
                return []
              return [
                `<${element.tagName.toLowerCase()} class="${element.getAttribute("class") ?? ""}"> ${filters[0]}`,
              ]
            },
          )
        }),
      {
        message: "elements over the board with a filter",
        timeout: SETTLE_MS,
      },
    )
    .toEqual([])
})
