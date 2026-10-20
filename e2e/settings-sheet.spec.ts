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
  for (const name of ["Select Language"]) {
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

test("the language select needs no label above it", async ({ page }) => {
  const dialog = await openSettings(page)
  await expect(
    dialog.getByRole("button", { name: "Select Language" }),
  ).toBeVisible()
  await expect(dialog.getByText("Select Language")).toHaveCount(0)
})

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

// TUD-973: a switch is the pill it always was, a 44x24 track with round ends
// that holds its thumb in either position. Its 44px hit area is not drawn: when
// the hit area was a transparent border, the track's corners took the border's
// radius and it rounded into an ellipse the thumb stuck out of.

type Rgb = [number, number, number]

/** The track a switch draws, in CSS px: centred on the switch's own box. */
const TRACK = { width: 44, height: 24 }

/**
 * Just inside a pill's round end and just outside an ellipse of the same box,
 * about 1px each way, at the top and bottom of each end: (6, 2.8) is 11 px from
 * the centre of a 12 px end, and past the edge of a 22x12 ellipse.
 */
const CORNERS = {
  left: [
    [6, 2.8],
    [6, TRACK.height - 2.8],
  ],
  right: [
    [TRACK.width - 6, 2.8],
    [TRACK.width - 6, TRACK.height - 2.8],
  ],
} as const

/**
 * The colour at each point (CSS px from the top left of `clip`), read from a
 * screenshot at device scale. Decoded in a blank page of the same browser, so
 * the app's content policy has no say over the image.
 */
async function pixelsAt(
  page: Page,
  clip: { x: number; y: number; width: number; height: number },
  points: readonly (readonly [number, number])[],
): Promise<Rgb[]> {
  const png = await page.screenshot({
    clip,
    scale: "device",
    animations: "disabled",
  })
  const blank = await page.context().newPage()
  try {
    return await blank.evaluate(
      async ({ data, width, points }) => {
        const image = new Image()
        image.src = `data:image/png;base64,${data}`
        await image.decode()
        const scale = image.naturalWidth / width
        const canvas = document.createElement("canvas")
        canvas.width = image.naturalWidth
        canvas.height = image.naturalHeight
        const context = canvas.getContext("2d")
        if (context === null) throw new Error("no 2d context")
        context.drawImage(image, 0, 0)
        return points.map(([x, y]) => {
          const [red, green, blue] = context.getImageData(
            Math.floor(x * scale),
            Math.floor(y * scale),
            1,
            1,
          ).data
          return [red, green, blue] as [number, number, number]
        })
      },
      { data: png.toString("base64"), width: clip.width, points },
    )
  } finally {
    await blank.close()
  }
}

function distance(a: Rgb, b: Rgb): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
}

/**
 * Reads the switch's free end, the one its thumb is not on: both corner points
 * there must be the track's colour, not what is behind the switch. The track's
 * colour is read in the middle of the free end, what is behind it at the clip's
 * very corner, outside any rounded shape.
 */
async function expectPillEnd(
  page: Page,
  toggle: Locator,
  freeEnd: "left" | "right",
): Promise<void> {
  const box = await toggle.boundingBox()
  expect(box).not.toBeNull()
  if (box === null) return
  const clip = {
    x: box.x + box.width / 2 - TRACK.width / 2,
    y: box.y + box.height / 2 - TRACK.height / 2,
    width: TRACK.width,
    height: TRACK.height,
  }
  const trackX = freeEnd === "left" ? 11 : TRACK.width - 11
  const [behind, track, ...corners] = await pixelsAt(page, clip, [
    [0.3, 0.3],
    [trackX, TRACK.height / 2],
    ...CORNERS[freeEnd],
  ])
  expect(
    distance(behind, track),
    "the track stands out from what is behind it",
  ).toBeGreaterThan(12)
  for (const corner of corners) {
    expect(
      distance(corner, track),
      `the ${freeEnd} end of the track is round like a pill, not an ellipse`,
    ).toBeLessThan(distance(corner, behind))
  }
}

for (const viewport of [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
]) {
  test.describe(`at ${viewport.width}x${viewport.height}, a settings switch`, () => {
    test.use({ viewport, deviceScaleFactor: 3 })

    test("is a pill that holds its thumb, off and on", async ({
      page,
    }) => {
      // At rest: a phone sheet slides up, and a screenshot clipped to where
      // the switch was a frame ago reads the wrong pixels.
      const dialog = await openSettings(page)
      const toggle = dialog.getByRole("switch").first()
      await expect(toggle).toBeInViewport({ ratio: 1 })

      // Off, the thumb sits on the left; on, on the right.
      const checked =
        (await toggle.getAttribute("aria-checked")) === "true"
      await expectPillEnd(page, toggle, checked ? "left" : "right")
      await toggle.click()
      await expect(toggle).toHaveAttribute(
        "aria-checked",
        String(!checked),
      )
      await expectPillEnd(page, toggle, checked ? "right" : "left")

      // Still a thumb's worth to press, whatever it draws.
      const box = await toggle.boundingBox()
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44)
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(44)
    })
  })
}

// TUD-973: focusing a field draws its ring blue from the first frame. The
// field's `transition` animated the outline colour in from the text colour, so
// the ring showed white and then faded to blue.

type RingFrame = {
  outlineStyle: string
  outlineWidth: string
  outlineColor: string
  boxShadow: string
}

/** The light blue every focus ring is drawn in (`--brand-light`). */
const RING_BLUE = "rgb(96, 164, 209)"

/** Starts reading the focused field's ring on every frame from now on. */
function recordRingFrames(page: Page): Promise<void> {
  return page.evaluate(() => {
    const frames: unknown[] = []
    ;(window as Window & { __ringFrames?: unknown[] }).__ringFrames =
      frames
    function sample() {
      const element = document.activeElement
      if (element instanceof HTMLInputElement) {
        const style = getComputedStyle(element)
        frames.push({
          outlineStyle: style.outlineStyle,
          outlineWidth: style.outlineWidth,
          outlineColor: style.outlineColor,
          boxShadow: style.boxShadow,
        })
      }
      requestAnimationFrame(sample)
    }
    requestAnimationFrame(sample)
  })
}

function ringFrames(page: Page): Promise<RingFrame[]> {
  return page.evaluate(
    () =>
      ((window as Window & { __ringFrames?: unknown[] }).__ringFrames ??
        []) as RingFrame[],
  )
}

/** Every colour in a computed `box-shadow` or colour value that is near white. */
function whiteColors(value: string): string[] {
  return [...value.matchAll(/rgba?\(([^)]*)\)/g)]
    .map((match) => match[0])
    .filter((color) => {
      const [red, green, blue, alpha = 1] = color
        .replace(/rgba?\(|\)/g, "")
        .split(/[\s,/]+/)
        .filter(Boolean)
        .map(Number)
      return alpha > 0 && red >= 200 && green >= 200 && blue >= 200
    })
}

for (const viewport of [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
]) {
  test.describe(`at ${viewport.width}x${viewport.height}, sign-in`, () => {
    test.use({ viewport })

    test("a focused field's ring is blue from its first frame, never white", async ({
      page,
    }) => {
      await openApp(page, "/")
      await recordRingFrames(page)
      await page.getByRole("button", { name: "Sign in" }).first().click()
      const form = page.getByRole("dialog")
      await form.getByLabel("Username").click()
      // Longer than any transition the app uses, so a fade has run its course.
      await page.waitForTimeout(600)
      await form.getByLabel("Password", { exact: true }).click()
      await page.waitForTimeout(600)

      const rings = (await ringFrames(page)).filter(
        (frame) =>
          frame.outlineStyle !== "none" &&
          Number.parseFloat(frame.outlineWidth) > 0,
      )
      expect(rings.length, "frames with a focus ring").toBeGreaterThan(0)
      for (const frame of rings) {
        expect(frame.outlineColor, "ring colour on every frame").toBe(
          RING_BLUE,
        )
        expect(
          whiteColors(frame.boxShadow),
          "white in the ring's shadow",
        ).toEqual([])
      }
    })
  })
}
