import type { Locator, Page } from "@playwright/test"
import { expect, test } from "@playwright/test"
import { openApp } from "./support/app"

// The settings overlay is one screen that never scrolls, on a phone or a
// desktop, and nothing in it moves when one of its dropdowns opens. The
// language options show a drawn flag, not the two letters a browser without a
// flag emoji font puts in its place. The sign-in overlay shows the focus ring of
// every field in full.

/** The smallest phone the app supports. */
const PHONE = { width: 375, height: 667 }

async function openSettings(page: Page): Promise<Locator> {
  await openApp(page, "/")
  await page
    .getByRole("button", { name: "Settings" })
    .filter({ visible: true })
    .first()
    .click()
  const dialog = page.getByRole("dialog")
  await expect(dialog).toBeVisible()
  // The sheet slides up on a phone; measure it where it comes to rest. The
  // slide starts a frame or two after the sheet mounts and may be driven from
  // script rather than a CSS animation, so "no animations" alone can be read
  // before it has moved: it has come to rest when it is on screen and still
  // from one frame to the next.
  await expect
    .poll(() =>
      dialog.evaluate(
        (element) =>
          new Promise<boolean>((resolve) => {
            const before = element.getBoundingClientRect().top
            requestAnimationFrame(() =>
              requestAnimationFrame(() => {
                const after = element.getBoundingClientRect().top
                resolve(
                  element.getAnimations().length === 0 &&
                    after === before &&
                    after < window.innerHeight - 1,
                )
              }),
            )
          }),
      ),
    )
    .toBe(true)
  return dialog
}

/**
 * Every box in the overlay that has more to show than room to show it, and the
 * overlay itself when it runs off the screen. An open dropdown's own list may
 * scroll its options; nothing else may.
 */
function overflowingBoxes(dialog: Locator): Promise<string[]> {
  return dialog.evaluate((root) => {
    const found: string[] = []
    // The sheet's own box runs past the bottom on purpose: an empty
    // aria-hidden spacer under it keeps the panel filled when it is dragged up
    // past its stop. What is drawn ends with the last child that is not it.
    const top = root.getBoundingClientRect().top
    const bottom = Math.max(
      ...[...root.children]
        .filter(
          (child) =>
            !(
              child.getAttribute("aria-hidden") === "true" &&
              child.childElementCount === 0
            ),
        )
        .map((child) => child.getBoundingClientRect().bottom),
    )
    if (top < -1 || bottom > window.innerHeight + 1) {
      found.push(
        `the overlay runs off the screen (${Math.round(top)}..${Math.round(bottom)} of ${window.innerHeight})`,
      )
    }
    for (const element of [root, ...root.querySelectorAll("*")]) {
      if (!(element instanceof HTMLElement)) continue
      if (element.closest('[role="listbox"]')) continue
      const overflowY = getComputedStyle(element).overflowY
      if (overflowY !== "auto" && overflowY !== "scroll") continue
      if (element.scrollHeight > element.clientHeight + 1) {
        found.push(
          `<${element.tagName.toLowerCase()} class="${element.className}"> scrolls ${element.scrollHeight - element.clientHeight}px`,
        )
      }
    }
    return found
  })
}

/** Where the overlay and every control in it sit, in document order. */
function controlBoxes(dialog: Locator): Promise<string[]> {
  return dialog.evaluate((root) => {
    const controls = [
      root,
      ...root.querySelectorAll("button, input, label, [role='switch']"),
    ].filter((element) => !element.closest('[role="listbox"]'))
    return controls.map((element) => {
      const { x, y, width, height } = element.getBoundingClientRect()
      const label =
        element.getAttribute("aria-label") ??
        element.textContent?.trim().slice(0, 30) ??
        ""
      return `${element.tagName.toLowerCase()} "${label}" ${x.toFixed(1)},${y.toFixed(1)} ${width.toFixed(1)}x${height.toFixed(1)}`
    })
  })
}

/** Opens each dropdown in turn and checks nothing moved and nothing scrolls. */
async function expectDropdownsOpenInPlace(dialog: Locator): Promise<void> {
  for (const name of ["Select Language", "Marble Design"]) {
    const before = await controlBoxes(dialog)
    await dialog.getByRole("button", { name }).click()
    await expect(dialog.getByRole("listbox", { name })).toBeVisible()

    expect(
      await controlBoxes(dialog),
      `${name} open moves nothing`,
    ).toEqual(before)
    expect(
      await overflowingBoxes(dialog),
      `${name} open scrolls nothing`,
    ).toEqual([])

    await dialog.getByRole("button", { name }).click()
    await expect(dialog.getByRole("listbox")).toHaveCount(0)
  }
}

test.describe("on a desktop", () => {
  test.skip(({ isMobile }) => isMobile, "the desktop shape of the overlay")

  test("the settings dialog fits without scrolling", async ({ page }) => {
    const dialog = await openSettings(page)
    expect(await overflowingBoxes(dialog)).toEqual([])
  })

  test("opening a dropdown in settings moves nothing", async ({
    page,
  }) => {
    const dialog = await openSettings(page)
    await expectDropdownsOpenInPlace(dialog)
  })
})

test.describe("on a 375x667 phone, settings", () => {
  test.use({ viewport: PHONE })

  test("the settings sheet fits without scrolling", async ({ page }) => {
    const dialog = await openSettings(page)
    expect(await overflowingBoxes(dialog)).toEqual([])
  })

  test("opening a dropdown in settings moves nothing", async ({
    page,
  }) => {
    const dialog = await openSettings(page)
    await expectDropdownsOpenInPlace(dialog)
  })
})

/**
 * Whether an element draws a flag: an `svg` or `img` at least 12px wide, and
 * no regional indicator letters, which are what a flag emoji falls back to on
 * a system with no flag font (Windows, most Linux).
 */
function drawsFlag(element: Locator): Promise<string | null> {
  return element.evaluate((node) => {
    const label = node.textContent?.trim() ?? ""
    if (/[\u{1F1E6}-\u{1F1FF}]/u.test(label)) {
      return `"${label}" is a flag emoji, drawn as letters without a flag font`
    }
    const drawn = [...node.querySelectorAll("svg, img")].some(
      (image) => image.getBoundingClientRect().width >= 12,
    )
    return drawn ? null : `"${label}" has no flag image`
  })
}

test("every language shows its flag as an image", async ({ page }) => {
  const dialog = await openSettings(page)
  const trigger = dialog.getByRole("button", { name: "Select Language" })
  expect(await drawsFlag(trigger), "the chosen language").toBeNull()

  await trigger.click()
  const options = dialog.getByRole("option")
  await expect(options).toHaveCount(13)
  for (const option of await options.all()) {
    expect.soft(await drawsFlag(option)).toBeNull()
  }
})

/**
 * Every box around the focused field that clips its focus ring. The ring is an
 * outline clear of the field or a box shadow, so it is drawn outside the field
 * by the outline's width and offset or the shadow's spread, and any ancestor
 * that clips its overflow has to leave that much room around the field.
 */
function ringClippers(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const field = document.activeElement
    if (!(field instanceof HTMLElement)) return ["nothing is focused"]
    const style = getComputedStyle(field)
    const shadow = style.boxShadow
    const outline =
      style.outlineStyle === "none"
        ? 0
        : Number.parseFloat(style.outlineWidth) +
          Number.parseFloat(style.outlineOffset)
    if (shadow === "none" && outline <= 0) {
      return ["the focused field draws no ring"]
    }

    // One spread per shadow: the fourth length in "color x y blur spread".
    const spread = Math.max(
      0,
      outline,
      ...(shadow === "none" ? [] : shadow.split(/,(?![^(]*\))/)).map(
        (part) => {
          const lengths = part.match(/-?[\d.]+px/g) ?? []
          return Number.parseFloat(lengths[3] ?? "0")
        },
      ),
    )
    const box = field.getBoundingClientRect()
    const ring = {
      left: box.left - spread,
      top: box.top - spread,
      right: box.right + spread,
      bottom: box.bottom + spread,
    }

    const clippers: string[] = []
    for (
      let ancestor = field.parentElement;
      ancestor !== null && ancestor !== document.documentElement;
      ancestor = ancestor.parentElement
    ) {
      const style = getComputedStyle(ancestor)
      if (style.overflowX === "visible" && style.overflowY === "visible") {
        continue
      }
      const outer = ancestor.getBoundingClientRect()
      const left = outer.left + ancestor.clientLeft
      const top = outer.top + ancestor.clientTop
      const inside =
        ring.left >= left - 0.5 &&
        ring.top >= top - 0.5 &&
        ring.right <= left + ancestor.clientWidth + 0.5 &&
        ring.bottom <= top + ancestor.clientHeight + 0.5
      if (!inside) {
        clippers.push(
          `<${ancestor.tagName.toLowerCase()} class="${ancestor.className}"> clips the ring of ${field.getAttribute("name") ?? field.id}`,
        )
      }
    }
    return clippers
  })
}

async function expectSignInRingsWhole(page: Page): Promise<void> {
  await openApp(page, "/")
  await page.getByRole("button", { name: "Sign in" }).first().click()
  const form = page.getByRole("dialog")
  await expect(form.getByLabel("Username")).toBeVisible()

  for (const tab of ["Sign in", "Create account"]) {
    await form.getByRole("tab", { name: tab }).click()
    const fields = form.locator("input:not([type='hidden'])")
    expect(await fields.count()).toBeGreaterThan(0)
    for (const field of await fields.all()) {
      await field.focus()
      expect.soft(await ringClippers(page), `${tab} form`).toEqual([])
    }
  }
}

test("the sign-in dialog shows the focus ring of every field in full", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "the desktop shape of the overlay")
  await expectSignInRingsWhole(page)
})

test.describe("on a 375x667 phone, sign-in", () => {
  test.use({ viewport: PHONE })

  test("the sign-in sheet shows the focus ring of every field in full", async ({
    page,
  }) => {
    await expectSignInRingsWhole(page)
  })
})
