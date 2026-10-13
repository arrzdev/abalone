import AxeBuilder from "@axe-core/playwright"
import type { Page } from "@playwright/test"
import { expect, test } from "@playwright/test"
import { openApp, startOfflineGame } from "./support/app"
import { moveList, playMove } from "./support/board"

// Every line of text reads at WCAG AA: 4.5:1 against its background, the
// secondary grey and the label on a blue button included. axe's
// `color-contrast` rule measures what the browser paints, at both widths.

const WIDTHS = [
  { name: "phone", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 900 },
]

/**
 * The contrast of an element's text against the opaque background behind it,
 * read the way the browser paints it: the text colour laid over the
 * backgrounds of its ancestors, translucent ones included. Null when something
 * else is painted over the middle of the text.
 */
function measureContrast(
  page: Page,
  selector: string,
): Promise<number | null> {
  return page.evaluate((selector) => {
    const element = document.querySelector(selector)
    if (!(element instanceof HTMLElement)) return null
    // Content scrolls behind a pinned bar; bring the text out from under it.
    element.scrollIntoView({ block: "center" })
    const box = element.getBoundingClientRect()
    const top = document.elementFromPoint(
      box.x + box.width / 2,
      box.y + box.height / 2,
    )
    if (top === null || !element.contains(top)) return null

    const canvas = document.createElement("canvas").getContext("2d")
    function toRgba(color: string): number[] {
      if (canvas === null) return [0, 0, 0, 0]
      canvas.clearRect(0, 0, 1, 1)
      canvas.fillStyle = color
      canvas.fillRect(0, 0, 1, 1)
      const [red, green, blue, alpha] = canvas.getImageData(
        0,
        0,
        1,
        1,
      ).data
      return [red, green, blue, alpha / 255]
    }
    function over(front: number[], back: number[]): number[] {
      const alpha = front[3]
      return [0, 1, 2].map(
        (channel) => front[channel] * alpha + back[channel] * (1 - alpha),
      )
    }
    function luminance([red, green, blue]: number[]): number {
      const [r, g, b] = [red, green, blue].map((channel) => {
        const value = channel / 255
        return value <= 0.03928
          ? value / 12.92
          : ((value + 0.055) / 1.055) ** 2.4
      })
      return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }

    // Translucent fills from the element outwards, then the first opaque one.
    const layers: number[][] = []
    let background = [255, 255, 255]
    for (
      let node: Element | null = element;
      node !== null;
      node = node.parentElement
    ) {
      const fill = toRgba(getComputedStyle(node).backgroundColor)
      if (fill[3] === 1) {
        background = fill
        break
      }
      if (fill[3] > 0) layers.push(fill)
    }
    for (const layer of layers.reverse())
      background = over(layer, background)

    const text = over(toRgba(getComputedStyle(element).color), background)
    const [light, dark] = [luminance(text), luminance(background)].sort(
      (a, b) => b - a,
    )
    return (light + 0.05) / (dark + 0.05)
  }, selector)
}

async function expectReadableText(page: Page, screen: string) {
  // A fade still running paints a colour on its way somewhere; read the one it
  // settles on. Endless ones (a spinner) never settle, so they are left out.
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .every(
        (animation) =>
          animation.playState !== "running" ||
          animation.effect?.getComputedTiming().endTime === Infinity,
      ),
  )
  // The hex lattice behind every screen is a separate layer of white lines at
  // 4.5% opacity, texture rather than a background; axe would give up on any
  // text above it. Read the text against the flat ground it is designed on.
  await page.addStyleTag({ content: ".hex-texture { display: none; }" })
  const results = await new AxeBuilder({ page })
    .withRules(["color-contrast"])
    .analyze()

  const failures = results.violations.flatMap((result) =>
    result.nodes.map((node) => `${node.target}: ${node.failureSummary}`),
  )
  // Text axe could not measure is listed as incomplete, not as a violation;
  // unmeasured is not readable either. Two kinds are settled here instead:
  // a lone glyph (a level number, a separator dot), which axe declines to call
  // text at all, and text axe's own model of the stacking order places under
  // something the browser does not paint over it. That text is measured here.
  for (const node of results.incomplete.flatMap(
    (result) => result.nodes,
  )) {
    const reason = node.any.map((check) => check.data?.messageKey)
    if (reason.includes("shortTextContent")) continue
    if (reason.includes("bgOverlap")) {
      const ratio = await measureContrast(page, String(node.target))
      if (ratio !== null && ratio >= 4.5) continue
      failures.push(`${node.target}: contrast ${ratio?.toFixed(2)}`)
      continue
    }
    failures.push(`${node.target}: ${node.failureSummary}`)
  }
  // Soft, so one run lists every page that falls short, not only the first.
  expect.soft(failures, `${screen} text below 4.5:1`).toEqual([])
}

for (const { name, width, height } of WIDTHS) {
  test.describe(`at ${width}px`, () => {
    test.use({ viewport: { width, height } })

    // One test per screen: each gets its own time budget, so a loaded machine
    // that is slow to hydrate and scan four pages in a row does not run one
    // test out of time (TUD-932).
    for (const path of ["/", "/rules", "/strategy", "/offline"]) {
      test(`${path} text is readable on a ${name}`, async ({ page }) => {
        await openApp(page, path)
        await expectReadableText(page, path)
      })
    }

    test(`a game against a bot is readable on a ${name}`, async ({
      page,
    }) => {
      await startOfflineGame(page, "vs Computer")
      // A move and the bot's reply fill the move list with numbers and moves.
      await playMove(page, "c5", "d5")
      await expect(moveList(page)).toHaveCount(2, { timeout: 30_000 })
      await expectReadableText(page, "game")
    })
  })
}

// A pointer on a blue control changes its fill, and the white label on it has
// to stay readable through that too. Only a desktop has a pointer that rests.
test.describe("at 1440px under the pointer", () => {
  test.use({ viewport: { width: 1440, height: 900 } })
  test.skip(({ hasTouch }) => hasTouch, "a touch screen has no hover")

  test("the vs Computer row stays readable while hovered", async ({
    page,
  }) => {
    await openApp(page, "/")
    await page.getByRole("button", { name: /^vs Computer/ }).hover()
    await expectReadableText(page, "hovered vs Computer")
  })

  test("the Play button stays readable while hovered", async ({
    page,
  }) => {
    await openApp(page, "/offline")
    await page.getByRole("button", { name: "Play", exact: true }).hover()
    await expectReadableText(page, "hovered Play")
  })
})
