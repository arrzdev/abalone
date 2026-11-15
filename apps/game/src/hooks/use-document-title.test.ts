import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { useDocumentTitle } from "@/hooks/use-document-title"
import { renderHook } from "@/test-support/render-hook"

describe("useDocumentTitle", () => {
  beforeEach(() => {
    document.title = "Route title"
  })

  afterEach(() => {
    document.title = ""
  })

  it("names the page with the brand appended", () => {
    const hook = renderHook(() => useDocumentTitle("Game on"))
    expect(document.title).toBe("Game on · Abalone")
    hook.unmount()
  })

  it("leaves the route's head alone for null", () => {
    const hook = renderHook(() => useDocumentTitle(null))
    expect(document.title).toBe("Route title")
    hook.unmount()
  })

  it("puts the route's title back on the way out", () => {
    const hook = renderHook(() => useDocumentTitle("Game on"))
    hook.unmount()
    expect(document.title).toBe("Route title")
  })

  //leaving for another route: the router has already written its title, and
  //putting ours back would overwrite it
  it("does not clobber a title somebody else has written since", () => {
    const hook = renderHook(() => useDocumentTitle("Game on"))
    document.title = "Next route · Abalone"
    hook.unmount()
    expect(document.title).toBe("Next route · Abalone")
  })
})
