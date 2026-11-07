/* =============================================================================
 * DRAWER FOCUS
 *
 * What a modal sheet owes the keyboard and a screen reader: focus moves in when
 * it opens, Tab goes round inside it, the page behind it is out of reach, and
 * focus goes back to where it was when it closes.
 * ============================================================================= */

//Everything a Tab press can land on. Disabled controls and `tabindex="-1"` are
//skipped by the browser, so they are skipped here too.
const TABBABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",")

//open sheets, oldest first. Only the last one answers a Tab press, so a sheet
//opened over a sheet is not fought for focus by the one under it.
const openPanels: HTMLElement[] = []

/**
 * The Tab stops inside a panel, in order. A radio group is one stop, its checked
 * radio, and an element with no box (inside a collapsed section) is not a stop.
 */
export function tabStops(panel: HTMLElement): HTMLElement[] {
  return [...panel.querySelectorAll<HTMLElement>(TABBABLE)].filter(
    (element) => {
      if (element.getClientRects().length === 0) return false
      if (!(element instanceof HTMLInputElement)) return true
      if (element.type !== "radio" || element.checked) return true
      const group = panel.querySelector(
        `input[type='radio'][name='${CSS.escape(element.name)}']:checked`,
      )
      return group === null
    },
  )
}

/**
 * Makes everything on the page but `keep` inert, and returns what undoes it.
 *
 * The drawer portals into the page, so "the page" is the other children of every
 * ancestor of the panel. Anything already inert is left alone and stays so: it
 * belongs to whoever set it, which is how a sheet over a sheet gives back only
 * what it took.
 */
function inertOutside(keep: readonly HTMLElement[]): () => void {
  const inerted: Element[] = []
  const panel = keep[0]
  if (panel === undefined) return () => {}

  let node: HTMLElement = panel
  while (node !== document.body && node.parentElement) {
    for (const sibling of node.parentElement.children) {
      if (sibling === node || keep.includes(sibling as HTMLElement))
        continue
      if (sibling.hasAttribute("inert")) continue
      sibling.setAttribute("inert", "")
      inerted.push(sibling)
    }
    node = node.parentElement
  }

  return () => {
    for (const element of inerted) element.removeAttribute("inert")
  }
}

export type DrawerFocusOptions = {
  panel: HTMLElement
  /** Stays reachable beside the panel: the backdrop. */
  keep?: HTMLElement | null
  /** What had focus before the drawer opened. */
  opener: HTMLElement | null
  /** Where focus goes on close when the opener is gone. */
  restoreFocus?: () => HTMLElement | null | undefined
}

/**
 * Takes the keyboard for an open drawer, and returns what gives it back.
 *
 * Focus lands on the panel itself, not on a control in it: a pointer open draws
 * no ring that way, and a keyboard user is a Tab from the first control. A field
 * that asked for focus on mount already has it and keeps it.
 */
export function trapDrawerFocus({
  panel,
  keep,
  opener,
  restoreFocus,
}: DrawerFocusOptions): () => void {
  openPanels.push(panel)
  const releaseInert = inertOutside(keep ? [panel, keep] : [panel])

  if (!panel.contains(document.activeElement)) {
    panel.focus({ preventScroll: true })
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Tab" || openPanels.at(-1) !== panel) return
    const stops = tabStops(panel)
    const first = stops[0]
    const last = stops.at(-1)
    if (first === undefined || last === undefined) {
      event.preventDefault()
      panel.focus({ preventScroll: true })
      return
    }
    const active = document.activeElement
    const outside = !panel.contains(active) || active === panel
    if (event.shiftKey && (outside || active === first)) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && (outside || active === last)) {
      event.preventDefault()
      first.focus()
    }
  }
  document.addEventListener("keydown", onKeyDown)

  return () => {
    document.removeEventListener("keydown", onKeyDown)
    releaseInert()
    const index = openPanels.lastIndexOf(panel)
    if (index !== -1) openPanels.splice(index, 1)

    //focus that already went somewhere else is not ours to take back
    const active = document.activeElement
    const free =
      active === null || active === document.body || panel.contains(active)
    if (!free) return
    const target = opener?.isConnected ? opener : restoreFocus?.()
    target?.focus()
  }
}
