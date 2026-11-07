import { act, cleanup, render } from "@testing-library/react"
import { useState } from "react"
import { afterEach, describe, expect, it } from "vitest"
import { Drawer } from "#nativ/components/drawer/drawer"

afterEach(cleanup)

function Harness({ restoreFocus }: { restoreFocus?: () => HTMLElement }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <main>
        <button type="button" onClick={() => setOpen(true)}>
          Open
        </button>
      </main>
      <Drawer
        open={open}
        onOpenChange={setOpen}
        restoreFocus={restoreFocus}
      >
        <Drawer.Portal>
          <Drawer.Overlay />
          <Drawer.Content aria-label="Sheet">
            <button type="button">First</button>
            <button type="button" onClick={() => setOpen(false)}>
              Last
            </button>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer>
    </>
  )
}

async function openFrom(button: HTMLElement) {
  button.focus()
  await act(async () => {
    button.click()
  })
}

describe("Drawer focus", () => {
  it("takes focus on open, makes the page inert and gives focus back on close", async () => {
    const { container, getByText, getByRole } = render(<Harness />)
    const opener = getByText("Open")
    await openFrom(opener)

    const panel = getByRole("dialog", { hidden: true })
    expect(document.activeElement).toBe(panel)
    expect(container.hasAttribute("inert")).toBe(true)
    expect(panel.hasAttribute("inert")).toBe(false)

    await act(async () => {
      getByText("Last").click()
    })
    expect(container.hasAttribute("inert")).toBe(false)
    expect(document.activeElement).toBe(opener)
  })

  it("keeps Tab inside the panel", async () => {
    const { getByText } = render(<Harness />)
    await openFrom(getByText("Open"))

    getByText("Last").focus()
    const forward = new KeyboardEvent("keydown", {
      key: "Tab",
      cancelable: true,
    })
    document.dispatchEvent(forward)
    expect(forward.defaultPrevented).toBe(true)
  })

  it("falls back to the caller's element when the opener is gone", async () => {
    const fallback = document.createElement("button")
    document.body.append(fallback)
    const { getByText } = render(<Harness restoreFocus={() => fallback} />)
    const opener = getByText("Open")
    await openFrom(opener)
    opener.remove()

    await act(async () => {
      getByText("Last").click()
    })
    expect(document.activeElement).toBe(fallback)
    fallback.remove()
  })
})
