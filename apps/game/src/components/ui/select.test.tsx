import { act } from "react"
import type { Root } from "react-dom/client"
import { createRoot } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { Select } from "@/components/ui/select"

//Escape in an open list closes the list and nothing else: the sheet or modal
//behind it listens for Escape on the document, and a press that reaches it
//closes the whole dialog (WCAG 2.4.3).
const OPTIONS = [
  { value: "en", label: "English" },
  { value: "pt", label: "Portuguese" },
]

let root: Root
let container: HTMLDivElement
const behind = vi.fn()

function press(target: Element, key: string) {
  act(() => {
    target.dispatchEvent(
      new KeyboardEvent("keydown", { key, bubbles: true }),
    )
  })
}

function trigger(): HTMLButtonElement {
  const button = container.querySelector<HTMLButtonElement>(
    '[aria-haspopup="listbox"]',
  )
  if (!button) throw new Error("no select trigger")
  return button
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  container = document.createElement("div")
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => {
    root.render(
      <Select
        value="en"
        onChange={() => {}}
        options={OPTIONS}
        label="Language"
      />,
    )
  })
  document.addEventListener("keydown", behind)
})

afterEach(() => {
  document.removeEventListener("keydown", behind)
  behind.mockClear()
  act(() => root.unmount())
  container.remove()
})

describe("Select, Escape", () => {
  it("closes the open list and keeps the press from the dialog behind it", () => {
    press(trigger(), "Enter")
    expect(container.querySelector('[role="listbox"]')).not.toBeNull()

    press(trigger(), "Escape")

    expect(container.querySelector('[role="listbox"]')).toBeNull()
    expect(behind).not.toHaveBeenCalledWith(
      expect.objectContaining({ key: "Escape" }),
    )
  })

  it("lets Escape through when the list is closed", () => {
    press(trigger(), "Escape")

    expect(behind).toHaveBeenCalledWith(
      expect.objectContaining({ key: "Escape" }),
    )
  })
})
