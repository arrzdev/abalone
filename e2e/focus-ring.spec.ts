import type { Page } from "@playwright/test"
import { expect, test } from "@playwright/test"
import { openApp } from "./support/app"

// Keyboard users see where they are: every Tab stop draws an outline at least
// 2px wide whose colour stands 3:1 against the background around it, and a
// mouse click draws none.

// Enough to walk the home page and an open drawer without looping forever.
const MAX_TAB_STOPS = 25

type FocusRing = {
  element: string
  outlineStyle: string
  outlineWidth: number
  contrast: number
}

/**
 * Reads the outline the focused element draws, and the contrast of its colour
 * against the first opaque background behind it, starting from the parent: the
 * outline is offset, so it sits on whatever the element sits on. Null once
 * focus leaves the page or comes back to a stop already read.
 */
function readFocusRing(page: Page): Promise<FocusRing | null> {
  return page.evaluate(() => {
    const element = document.activeElement
    if (!(element instanceof HTMLElement) || element === document.body) {
      return null
    }
    // Focus has come back round to a stop already checked.
    if (element.dataset.focusRingVisited !== undefined) return null
    element.dataset.focusRingVisited = ""

    // A switch or checkbox hides its input; the label around it is what shows.
    const drawn =
      element.classList.contains("sr-only") &&
      element.parentElement instanceof HTMLLabelElement
        ? element.parentElement
        : element

    const canvas = document.createElement("canvas").getContext("2d")
    function toRgba(color: string): number[] {
      if (canvas === null) return [0, 0, 0, 0]
      canvas.clearRect(0, 0, 1, 1)
      canvas.fillStyle = color
      canvas.fillRect(0, 0, 1, 1)
      return [...canvas.getImageData(0, 0, 1, 1).data]
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

    let background = toRgba("#ffffff")
    for (
      let ancestor = drawn.parentElement;
      ancestor !== null;
      ancestor = ancestor.parentElement
    ) {
      const color = toRgba(getComputedStyle(ancestor).backgroundColor)
      if (color[3] === 255) {
        background = color
        break
      }
    }

    const style = getComputedStyle(drawn)
    const lighter = Math.max(
      luminance(toRgba(style.outlineColor)),
      luminance(background),
    )
    const darker = Math.min(
      luminance(toRgba(style.outlineColor)),
      luminance(background),
    )
    const label =
      element.getAttribute("aria-label") ??
      element.textContent?.trim() ??
      ""

    return {
      element: `${element.tagName.toLowerCase()} "${label.slice(0, 40)}"`,
      outlineStyle: style.outlineStyle,
      outlineWidth: Number.parseFloat(style.outlineWidth),
      contrast: (lighter + 0.05) / (darker + 0.05),
    }
  })
}

/** Presses Tab until focus leaves the page or comes back round, and checks each stop. */
async function expectEveryTabStopRinged(page: Page): Promise<void> {
  const seen: string[] = []
  for (let stop = 0; stop < MAX_TAB_STOPS; stop++) {
    await page.keyboard.press("Tab")
    const ring = await readFocusRing(page)
    if (ring === null) break
    seen.push(ring.element)

    expect
      .soft(ring.outlineStyle, `${ring.element} outline style`)
      .not.toBe("none")
    expect
      .soft(ring.outlineWidth, `${ring.element} outline width`)
      .toBeGreaterThanOrEqual(2)
    expect
      .soft(ring.contrast, `${ring.element} outline contrast`)
      .toBeGreaterThanOrEqual(3)
  }
  expect(seen.length, "tab stops reached").toBeGreaterThan(0)
}

// Tab only means something with a keyboard; the phone project has none.
test.skip(({ isMobile }) => isMobile, "keyboard focus is a desktop flow")

test("every tab stop on the home page shows a focus ring", async ({
  page,
}) => {
  await openApp(page, "/")
  await expectEveryTabStopRinged(page)
})

test("every tab stop in the settings drawer shows a focus ring", async ({
  page,
}) => {
  await openApp(page, "/")
  await page.getByRole("button", { name: "Settings" }).click()
  await expect(page.getByRole("dialog")).toBeVisible()
  await expectEveryTabStopRinged(page)
})

test("a mouse click on a control draws no focus ring", async ({
  page,
}) => {
  await openApp(page, "/")
  await page.getByRole("button", { name: "Settings" }).click()
  // A toggle keeps focus after it is pressed, so the click leaves it focused.
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Mute" })
    .click()

  const focused = await page.evaluate(() => {
    const element = document.activeElement
    return element instanceof HTMLElement
      ? {
          label: element.getAttribute("aria-label"),
          outlineStyle: getComputedStyle(element).outlineStyle,
        }
      : null
  })
  expect(focused?.label).toMatch(/mute/i)
  expect(focused?.outlineStyle).toBe("none")
})
