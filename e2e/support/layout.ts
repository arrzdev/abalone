import type { Locator } from "@playwright/test"
import { expect } from "@playwright/test"

// Three checks any spec can run on a dialog, a sheet or a page region:
//
// - nothing moves when a button is pressed (`expectNoLayoutShift`),
// - no text is cut off by its own box or by a box that clips it
//   (`expectNoClippedText`),
// - the space between the blocks inside it follows one rhythm
//   (`expectEvenRhythm`).
//
// Each one fails with a list of what is wrong and where, so the message is the
// bug report. The rules they encode are in docs/ui-layout-checks.md.

/** How far two measurements may differ and still count as the same. */
const TOLERANCE = 1

/**
 * Presses something and checks that nothing inside `scope`, or `scope` itself,
 * moved or changed size, in any frame from the press until `until` resolves
 * and the region has come to rest.
 *
 * Boxes are layout boxes: `offsetTop`/`offsetLeft` up the offset chain, so a
 * transform (a button's press scale, a sheet's slide) is not a shift, and
 * neither is a scroll. Elements that the action removes are let go; elements it
 * adds are not compared, but anything already there that they push is.
 *
 * `ignore` is a selector for elements whose own box is expected to change (a
 * label whose text changes in a box that is not fixed). Their neighbours are
 * still checked.
 */
export async function expectNoLayoutShift(
  scope: Locator,
  action: () => Promise<void>,
  options: { until?: () => Promise<void>; ignore?: string } = {},
): Promise<void> {
  await waitForRest(scope)
  await scope.evaluate((root, ignore) => {
    type Box = { x: number; y: number; width: number; height: number }
    type Recorder = {
      baseline: Map<HTMLElement, Box>
      moved: string[]
      stop: boolean
    }

    const layoutBox = (element: HTMLElement): Box => {
      let x = 0
      let y = 0
      let current: HTMLElement | null = element
      while (current) {
        x += current.offsetLeft
        y += current.offsetTop
        current = current.offsetParent as HTMLElement | null
      }
      return {
        x,
        y,
        width: element.offsetWidth,
        height: element.offsetHeight,
      }
    }

    const describe = (element: HTMLElement): string => {
      const name =
        element.getAttribute("aria-label") ??
        element.textContent?.trim().replace(/\s+/g, " ").slice(0, 40) ??
        ""
      return `<${element.tagName.toLowerCase()}> "${name}"`
    }

    const tracked = [root, ...root.querySelectorAll("*")].filter(
      (element): element is HTMLElement =>
        element instanceof HTMLElement &&
        !(ignore && element.matches(ignore)),
    )
    const recorder: Recorder = {
      baseline: new Map(
        tracked.map((element) => [element, layoutBox(element)]),
      ),
      moved: [],
      stop: false,
    }
    const reported = new Set<HTMLElement>()

    const sample = () => {
      for (const [element, before] of recorder.baseline) {
        if (!element.isConnected || reported.has(element)) continue
        const after = layoutBox(element)
        const delta = Math.max(
          Math.abs(after.x - before.x),
          Math.abs(after.y - before.y),
          Math.abs(after.width - before.width),
          Math.abs(after.height - before.height),
        )
        if (delta === 0) continue
        reported.add(element)
        recorder.moved.push(
          `${describe(element)} ${before.x},${before.y} ${before.width}x${before.height} → ${after.x},${after.y} ${after.width}x${after.height}`,
        )
      }
      if (!recorder.stop) requestAnimationFrame(sample)
    }

    Object.assign(window, {
      __layoutShift: recorder,
      __layoutSample: sample,
    })
    requestAnimationFrame(sample)
  }, options.ignore ?? null)

  await action()
  if (options.until) await options.until()
  await waitForRest(scope)

  const moved = await scope.evaluate(() => {
    const shiftWindow = window as unknown as {
      __layoutShift: { moved: string[]; stop: boolean }
      __layoutSample: () => void
    }
    shiftWindow.__layoutShift.stop = true
    //one last look at where everything came to rest
    shiftWindow.__layoutSample()
    return shiftWindow.__layoutShift.moved
  })
  expect(moved, "elements that moved or changed size").toEqual([])
}

/**
 * Checks that every piece of text inside `scope` is shown in full:
 *
 * - no box with text is wider (or, when it clips, taller) than its own room,
 *   unless it ends in an ellipsis (`text-overflow: ellipsis`, or a line clamp);
 * - no line of text, and no field, reaches outside a box that clips it (the
 *   dialog, its scroller, any `overflow` other than `visible`) or outside the
 *   screen.
 *
 * Text that is there only for screen readers (`sr-only`), or kept invisible to
 * hold space, is skipped.
 */
export async function expectNoClippedText(scope: Locator): Promise<void> {
  const clipped = await scope.evaluate((root) => {
    const found: string[] = []
    const slack = 1

    const describe = (element: Element, text: string): string =>
      `<${element.tagName.toLowerCase()}> "${text.trim().replace(/\s+/g, " ").slice(0, 50)}"`

    const isShown = (element: Element): boolean => {
      const style = getComputedStyle(element)
      if (style.visibility === "hidden" || style.display === "none")
        return false
      for (
        let current: Element | null = element;
        current;
        current = current.parentElement
      ) {
        if (Number(getComputedStyle(current).opacity) === 0) return false
      }
      const box = element.getBoundingClientRect()
      //`sr-only`: a 1px box that clips everything in it
      return box.width > 1 && box.height > 1
    }

    /** Every box between `element` and the screen that cuts off what spills out of it. */
    const clippingBoxes = (element: Element): DOMRect[] => {
      const boxes: DOMRect[] = [
        new DOMRect(0, 0, window.innerWidth, window.innerHeight),
      ]
      for (
        let current = element.parentElement;
        current;
        current = current.parentElement
      ) {
        const style = getComputedStyle(current)
        if (style.overflowX === "visible" && style.overflowY === "visible")
          continue
        const box = current.getBoundingClientRect()
        boxes.push(
          new DOMRect(
            box.left + current.clientLeft,
            box.top + current.clientTop,
            current.clientWidth,
            current.clientHeight,
          ),
        )
      }
      return boxes
    }

    const outside = (rect: DOMRect, clip: DOMRect): boolean =>
      rect.left < clip.left - slack ||
      rect.top < clip.top - slack ||
      rect.right > clip.right + slack ||
      rect.bottom > clip.bottom + slack

    const endsInEllipsis = (style: CSSStyleDeclaration): boolean =>
      style.textOverflow === "ellipsis" ||
      (style.webkitLineClamp !== "" && style.webkitLineClamp !== "none")

    const elements = [root, ...root.querySelectorAll("*")]
    for (const element of elements) {
      if (!(element instanceof HTMLElement) || !isShown(element)) continue

      const isField =
        element instanceof HTMLInputElement ||
        element instanceof HTMLTextAreaElement
      const ownText = isField
        ? (element.value ?? "")
        : [...element.childNodes]
            .filter((node) => node.nodeType === Node.TEXT_NODE)
            .map((node) => node.textContent ?? "")
            .join("")
      if (ownText.trim() === "") continue
      if (isField && ["checkbox", "radio", "range"].includes(element.type))
        continue

      const style = getComputedStyle(element)

      //the box's own room: inline boxes have none of their own
      if (style.display !== "inline") {
        const clipsY = style.overflowY !== "visible"
        const tooWide = element.scrollWidth > element.clientWidth + slack
        const tooTall =
          clipsY && element.scrollHeight > element.clientHeight + slack
        if ((tooWide || tooTall) && !endsInEllipsis(style)) {
          found.push(
            `${describe(element, ownText)} needs ${element.scrollWidth}x${element.scrollHeight} and has ${element.clientWidth}x${element.clientHeight}, with no ellipsis`,
          )
          continue
        }
      }

      //every line it draws, against every box that clips it
      const lines: DOMRect[] = []
      if (isField) {
        lines.push(element.getBoundingClientRect())
      } else {
        for (const node of element.childNodes) {
          if (node.nodeType !== Node.TEXT_NODE) continue
          if ((node.textContent ?? "").trim() === "") continue
          const range = document.createRange()
          range.selectNodeContents(node)
          lines.push(...range.getClientRects())
        }
      }
      const clips = clippingBoxes(element)
      const cut = lines.find((line) =>
        clips.some((clip) => outside(line, clip)),
      )
      if (cut) {
        found.push(
          `${describe(element, ownText)} at ${Math.round(cut.left)},${Math.round(cut.top)}..${Math.round(cut.right)},${Math.round(cut.bottom)} is cut off by a box around it`,
        )
      }
    }
    return found
  })
  expect(clipped, "text that is cut off").toEqual([])
}

/**
 * Checks that `scope` fits on the screen as it is: no box in it (the scope
 * itself included) that scrolls has more than it shows. A sheet's scroller
 * that has a few pixels more also fades its bottom edge over the last control,
 * which `expectNoClippedText` does not see, since the text is still inside it.
 */
export async function expectNoScrolling(scope: Locator): Promise<void> {
  const scrolling = await scope.evaluate((root) => {
    const found: string[] = []
    const slack = 1
    for (const element of [root, ...root.querySelectorAll("*")]) {
      const style = getComputedStyle(element)
      const scrolls = (overflow: string): boolean =>
        overflow === "auto" || overflow === "scroll"
      if (!scrolls(style.overflowY) && !scrolls(style.overflowX)) continue
      const extraY = element.scrollHeight - element.clientHeight
      const extraX = element.scrollWidth - element.clientWidth
      if (extraY <= slack && extraX <= slack) continue
      const text = (element.textContent ?? "")
        .trim()
        .replace(/\s+/g, " ")
        .slice(0, 50)
      found.push(
        `<${element.tagName.toLowerCase()}> "${text}" needs ${element.scrollWidth}x${element.scrollHeight} and shows ${element.clientWidth}x${element.clientHeight}`,
      )
    }
    return found
  })
  expect(scrolling, "boxes that scroll").toEqual([])
}

/** The vertical gaps inside a region, and the bands of content between them. */
export type Rhythm = {
  /** Each band of content, top to bottom, named by its first text. */
  bands: string[]
  /** The gap after each band but the last, in px. */
  gaps: number[]
  /** The gap sizes in use, smallest first: at most a tight one and a section one. */
  sizes: number[]
}

/**
 * Measures the vertical rhythm of `scope` and checks it has at most two gaps,
 * each the same everywhere it is used (±1px): a tight one (a label and its
 * control, a title and the line under it, a field and its hint) and a section
 * one (between sections, and above the primary action). An empty block of
 * reserved space shows up as a third, larger gap.
 *
 * What counts as content: a box with its own text, a control (button, field,
 * radio, switch, tab), a picture (canvas, svg, img), and a box with a
 * background or a shadow. A box with only a top or bottom border counts as
 * that line. What is `aria-hidden` or positioned out of the flow, and outside
 * such a box (a sheet's grabber, a spacer, a close button in the corner), does
 * not count. Overlapping and touching boxes form one band.
 *
 * `sizes` holds the gaps to the house tokens as well, so every region keeps the
 * same rhythm and not only one of its own. Returns what it measured.
 */
export async function expectEvenRhythm(
  scope: Locator,
  options: { sizes?: number[] } = {},
): Promise<Rhythm> {
  await waitForRest(scope)
  const measured = await scope.evaluate((root) => {
    type Band = { top: number; bottom: number; name: string }
    const painted: Band[] = []
    const scopeHeight = root.getBoundingClientRect().height

    const isControl = (element: Element): boolean =>
      element.matches(
        "button, input, textarea, select, canvas, svg, img, [role='radio'], [role='switch'], [role='tab'], [role='button']",
      )

    const nameOf = (element: Element): string =>
      (
        element.getAttribute("aria-label") ??
        element.textContent?.trim().replace(/\s+/g, " ") ??
        ""
      ).slice(0, 30) || `<${element.tagName.toLowerCase()}>`

    const visit = (element: Element) => {
      const style = getComputedStyle(element)
      if (style.display === "none" || style.visibility === "hidden") return
      if (element.getAttribute("aria-hidden") === "true") return
      //out of the flow (a dialog's close button in its corner): it sits over
      //the rhythm rather than in it
      if (style.position === "absolute" || style.position === "fixed")
        return

      const box = element.getBoundingClientRect()
      if (box.width <= 1 || box.height <= 1) {
        for (const child of element.children) visit(child)
        return
      }

      const ownText = [...element.childNodes].some(
        (node) =>
          node.nodeType === Node.TEXT_NODE &&
          (node.textContent ?? "").trim() !== "",
      )
      const transparent = (color: string) =>
        color === "transparent" || /rgba\(.*,\s*0\)$/.test(color)
      const filled =
        !transparent(style.backgroundColor) ||
        style.backgroundImage !== "none" ||
        style.boxShadow !== "none"

      //a filled box taller than half the region is the surface the content
      //sits on (a sheet's panel, a scroller with a background), not a block
      const surface = filled && !ownText && box.height > scopeHeight / 2

      if (!surface && (ownText || filled || isControl(element))) {
        //a box that draws itself already covers everything inside it
        painted.push({
          top: box.top,
          bottom: box.bottom,
          name: nameOf(element),
        })
        return
      }

      const borderTop = Number.parseFloat(style.borderTopWidth)
      const borderBottom = Number.parseFloat(style.borderBottomWidth)
      if (borderTop > 0 && !transparent(style.borderTopColor)) {
        painted.push({
          top: box.top,
          bottom: box.top + borderTop,
          name: "(divider)",
        })
      }
      if (borderBottom > 0 && !transparent(style.borderBottomColor)) {
        painted.push({
          top: box.bottom - borderBottom,
          bottom: box.bottom,
          name: "(divider)",
        })
      }
      for (const child of element.children) visit(child)
    }

    for (const child of root.children) visit(child)

    painted.sort((a, b) => a.top - b.top)
    const bands: Band[] = []
    for (const box of painted) {
      const last = bands.at(-1)
      if (last && box.top <= last.bottom + 0.5) {
        last.bottom = Math.max(last.bottom, box.bottom)
      } else {
        bands.push({ ...box })
      }
    }
    return {
      bands: bands.map((band) => band.name),
      gaps: bands
        .slice(1)
        .map(
          (band, index) =>
            Math.round((band.top - bands[index].bottom) * 10) / 10,
        ),
    }
  })

  //gaps within a pixel of each other are the same gap
  const clusters: number[][] = []
  for (const gap of [...measured.gaps].sort((a, b) => a - b)) {
    const last = clusters.at(-1)
    if (last && gap - last[0] <= TOLERANCE) last.push(gap)
    else clusters.push([gap])
  }
  const report = measured.bands
    .map((band, index) =>
      index < measured.gaps.length
        ? `${band}\n    ↕ ${measured.gaps[index]}px`
        : band,
    )
    .join("\n")
  expect(
    clusters.length,
    `at most two gap sizes (tight, section), found ${clusters.map((cluster) => cluster[0]).join(", ")} px:\n${report}`,
  ).toBeLessThanOrEqual(2)

  const sizes = clusters.map((cluster) => cluster[0])
  if (options.sizes) {
    const allowed = options.sizes
    const offRhythm = sizes.filter(
      (size) =>
        !allowed.some((token) => Math.abs(size - token) <= TOLERANCE),
    )
    expect(
      offRhythm,
      `gaps other than the ${allowed.join(" and ")} px tokens:\n${report}`,
    ).toEqual([])
  }

  return { ...measured, sizes }
}

/**
 * Waits until nothing inside `scope` is animating and its box holds still from
 * one frame to the next, so a sheet sliding up is measured where it stops.
 */
export async function waitForRest(scope: Locator): Promise<void> {
  await expect
    .poll(() =>
      scope.evaluate(
        (element) =>
          new Promise<boolean>((resolve) => {
            const before = element.getBoundingClientRect()
            requestAnimationFrame(() =>
              requestAnimationFrame(() => {
                const after = element.getBoundingClientRect()
                const running = element
                  .getAnimations({ subtree: true })
                  .some((animation) => animation.playState === "running")
                resolve(
                  !running &&
                    after.top === before.top &&
                    after.height === before.height &&
                    after.top < window.innerHeight - 1,
                )
              }),
            )
          }),
      ),
    )
    .toBe(true)
}
