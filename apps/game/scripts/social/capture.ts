import { mkdir } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import type { Browser, Page } from "@playwright/test"
import { chromium } from "@playwright/test"

/**
 * The three pictures a shared link unfurls into, taken from the app itself.
 *
 * They are screenshots rather than artwork on purpose: a card that is drawn by
 * hand is a promise, and a card that is the running app is the thing. It also
 * means the cards cannot quietly stop matching the product — when a screen
 * changes, this is re-run and they change with it.
 *
 * Point it at a dev server that is already up:
 *
 *   pnpm --filter @repo/game dev
 *   pnpm social:images
 *
 * `SOCIAL_BASE_URL` overrides the target, the way `E2E_BASE_URL` does for the
 * Playwright suite.
 */

const BASE_URL = process.env.SOCIAL_BASE_URL ?? "http://127.0.0.1:6161"

const OUTPUT_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../public/images/social",
)

/**
 * Every card comes out 2400×1260 — twice the 1200×630 the renderers state, so
 * the marbles stay round on a retina screen, and the 1.91:1 they all crop to.
 *
 * What differs is the window it was shot through. A screen laid out for a
 * desktop and then squeezed to the height of a letterbox is not the same
 * picture: the poster loosens into its extra room and wants the tighter frame,
 * while the game screen at that height spends the difference on a scrollbar.
 * So each card names the width it is framed best at, and the scale that brings
 * it back to the one output size.
 */
/**
 * JPEG, not PNG, and for a reason that is not about the picture: the service
 * worker precaches every `.png` under the built client, so three lossless
 * screenshots nobody in the app ever opens would be a megabyte added to every
 * install to serve crawlers. JPEG is out of that glob, is what most cards are
 * anyway, and at this quality the difference is not visible at the size these
 * are shown.
 */
const JPEG_QUALITY = 92

const FRAMES = {
  poster: { viewport: { width: 1200, height: 630 }, scale: 2 },
  screen: { viewport: { width: 1600, height: 840 }, scale: 1.5 },
} as const

/* =============================================================================
 * BOARD GEOMETRY
 * ============================================================================= */

/**
 * The canvas' own mapping from a cell to a pixel, restated.
 *
 * `GameCanvas` letterboxes an 800×700 board into whatever box it is handed and
 * keeps the resulting geometry in a ref, so there is nothing on the element to
 * read it back from. The numbers it derives are derivable again from the
 * canvas' size, which is what this does — the constants are the canvas'
 * (`BASE_WIDTH`, `BASE_RADIUS`) and have to stay in step with them.
 */
const BASE_WIDTH = 800
const BASE_RADIUS = 40
const ROOT3 = Math.sqrt(3)

/** Axial (r, q) of one square. Rows run r = -4 at the top to r = +4 at the bottom. */
type Cell = [row: number, column: number]

async function clickCell(page: Page, cell: Cell): Promise<void> {
  const box = await page.locator("canvas").first().boundingBox()
  if (!box) throw new Error("the board has no box to click in")

  const spacing = BASE_RADIUS * (box.width / BASE_WIDTH) * 1.14
  const [row, column] = cell

  await page.mouse.click(
    box.x + box.width / 2 + spacing * (ROOT3 * column + (ROOT3 / 2) * row),
    box.y + box.height / 2 + spacing * (3 / 2) * row,
  )
}

/**
 * Single marbles stepping up the board, one square at a time.
 *
 * A one-marble step into an empty square is legal from any position, which is
 * what makes it the move to script: the bot answers each one, and what comes out
 * is a real game rather than an arrangement. The opening is the standard setup,
 * so black holds rows 2 to 4 and the row above them is empty.
 */
const OPENING: Array<[from: Cell, to: Cell]> = [
  [
    [2, 0],
    [1, 0],
  ],
  [
    [2, -1],
    [1, -1],
  ],
  [
    [3, 1],
    [2, 1],
  ],
  [
    [1, 0],
    [0, 0],
  ],
]

/* =============================================================================
 * THE THREE CARDS
 * ============================================================================= */

/** The front door, with the board part-way through the game it plays itself. */
async function captureHome(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/`, { waitUntil: "load" })
  //the poster reveals, and the demo game needs a few moves in it before the
  //board is a position rather than an opening
  await page.waitForTimeout(9_000)
}

/** A game against a bot, a handful of moves in. */
async function captureGame(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/offline?mode=ai`, { waitUntil: "load" })
  //black, so the board is never turned round mid-capture
  await page.getByRole("radio", { name: "Play as black" }).click()
  await page.getByRole("button", { name: "Play", exact: true }).click()
  await page.waitForTimeout(1_500)

  for (const [from, to] of OPENING) {
    await clickCell(page, from)
    await clickCell(page, to)
    //the move animates, then the bot searches and answers
    await page.waitForTimeout(3_000)
  }
}

/** The rules, as the diagrams that teach them. */
async function captureRules(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/rules`, { waitUntil: "load" })
  await page.waitForTimeout(2_000)
}

/* =============================================================================
 * RUN
 * ============================================================================= */

/**
 * A scrollbar is the app telling somebody there is more below, and a card has no
 * below: it is one still frame, and the light bar down the middle of it reads as
 * a seam. Hidden here rather than in the app, where it is doing its job.
 */
const HIDE_SCROLLBARS = `
  *::-webkit-scrollbar { width: 0 !important; height: 0 !important }
  * { scrollbar-width: none !important }
`

type Frame = (typeof FRAMES)[keyof typeof FRAMES]

async function card(
  browser: Browser,
  filename: string,
  frame: Frame,
  arrange: (page: Page) => Promise<void>,
): Promise<void> {
  const context = await browser.newContext({
    viewport: frame.viewport,
    deviceScaleFactor: frame.scale,
    colorScheme: "dark",
    reducedMotion: "no-preference",
  })
  const page = await context.newPage()

  await arrange(page)
  await page.addStyleTag({ content: HIDE_SCROLLBARS })
  await page.screenshot({
    path: path.join(OUTPUT_DIR, filename),
    quality: JPEG_QUALITY,
    type: "jpeg",
  })

  await context.close()
  console.log(`✓ ${filename}`)
}

await mkdir(OUTPUT_DIR, { recursive: true })

const browser = await chromium.launch()

await card(browser, "og-home.jpg", FRAMES.poster, captureHome)
await card(browser, "og-game.jpg", FRAMES.screen, captureGame)
await card(browser, "og-rules.jpg", FRAMES.screen, captureRules)

await browser.close()
console.log(`→ ${OUTPUT_DIR}`)
