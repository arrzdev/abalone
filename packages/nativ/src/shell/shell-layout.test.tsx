import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import { createRootDocument } from "#nativ/shell/shell-layout"

//the head and script slots need a live router; the document's own markup doesn't
vi.mock("@tanstack/react-router", () => ({
  HeadContent: () => null,
  Scripts: () => null,
}))

//its import chain ends in a virtual module only the nativ vite plugin serves
vi.mock("#nativ/hooks/use-register-pwa-service-worker", () => ({
  useRegisterPwaServiceWorker: () => {},
}))

function renderDocument(allowZoom?: boolean) {
  const RootDocument = createRootDocument({ allowZoom })
  const markup = renderToStaticMarkup(<RootDocument>app</RootDocument>)
  const parsed = new DOMParser().parseFromString(markup, "text/html")
  return {
    html: parsed.documentElement,
    body: parsed.body,
  }
}

function classesOf(element: Element) {
  return element.className.split(/\s+/)
}

describe("createRootDocument", () => {
  it("locks html and body against every gesture without allowZoom", () => {
    const { html, body } = renderDocument()
    for (const element of [html, body]) {
      expect(classesOf(element)).toContain("touch-none")
      expect(classesOf(element)).toContain("overscroll-none")
      expect(classesOf(element)).not.toContain("touch-manipulation")
    }
    expect(html.hasAttribute("data-allow-zoom")).toBe(false)
  })

  it("lets pinch zoom through html and body with allowZoom", () => {
    const { html, body } = renderDocument(true)
    for (const element of [html, body]) {
      expect(classesOf(element)).toContain("touch-manipulation")
      expect(classesOf(element)).toContain("overscroll-none")
      expect(classesOf(element)).not.toContain("touch-none")
    }
    expect(html.hasAttribute("data-allow-zoom")).toBe(true)
  })
})
