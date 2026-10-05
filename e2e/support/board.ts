import type { Page } from "@playwright/test"
import { expect } from "@playwright/test"

// The board is a canvas. The game's dev build puts a probe on `window` for the
// board being played on (apps/game/src/test-support/board-probe.ts); these read
// it by algebraic square, and press the board with a real pointer.

type Marble = "black" | "white" | null

type Point = { x: number; y: number }

// The shape apps/game declares on `window`, restated: the suite does not compile
// against the app's sources.
type ProbeWindow = Window & {
  __abaloneBoard?: {
    point: (square: string) => Point | null
    marble: (square: string) => Marble
    takesInput: () => boolean
  }
}

/**
 * Presses the centre of a square, the way a player taps it. Waits for the board
 * to take input first: a press while it is loading or waiting on the other side
 * is ignored, which is the game working rather than the test.
 */
export async function tapSquare(
  page: Page,
  square: string,
): Promise<void> {
  let point: Point | null = null
  await expect
    .poll(
      async () => {
        point = await page.evaluate((name) => {
          const board = (window as ProbeWindow).__abaloneBoard
          return board?.takesInput() ? board.point(name) : null
        }, square)
        return point
      },
      { message: `square ${square} on a board that takes input` },
    )
    .not.toBeNull()
  const { x, y } = point as unknown as Point
  await page.mouse.click(x, y)
}

/** The marble on a square right now, read off the game state the board draws. */
export function marbleOn(page: Page, square: string): Promise<Marble> {
  return page.evaluate(
    (name) => (window as ProbeWindow).__abaloneBoard?.marble(name) ?? null,
    square,
  )
}

/** Waits until a square holds `marble` (null = empty). */
export async function expectMarble(
  page: Page,
  square: string,
  marble: Marble,
): Promise<void> {
  await expect
    .poll(() => marbleOn(page, square), { message: `marble on ${square}` })
    .toBe(marble)
}

/**
 * Plays one move: the marble, then where it goes. Waits for the move to land,
 * since the board ignores input while a move is animating.
 */
export async function playMove(
  page: Page,
  from: string,
  to: string,
): Promise<void> {
  // The probe is only up once the board takes moves, which for an online game
  // is after it has loaded and it is this player's turn.
  let mover: Marble = null
  await expect
    .poll(
      async () => {
        mover = await marbleOn(page, from)
        return mover
      },
      { message: `a marble on ${from} to move` },
    )
    .not.toBeNull()
  await tapSquare(page, from)
  await tapSquare(page, to)
  await expectMarble(page, to, mover)
  await expectMarble(page, from, null)
}

/** The move list, as the notation it shows ("c5d5"). */
export function moveList(page: Page) {
  return page.locator(".font-mono").filter({ hasText: /^[a-i]\d[a-i]\d$/ })
}
