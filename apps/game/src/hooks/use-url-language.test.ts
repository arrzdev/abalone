import { describe, expect, it, vi } from "vitest"
import { useUrlLanguage } from "@/hooks/use-url-language"
import { renderHook } from "@/test-support/render-hook"

const router = vi.hoisted(() => ({ publicHref: "/" }))

//the router's state is just the one field this hook selects from
vi.mock("@tanstack/react-router", () => ({
  useRouterState: (options: { select: (state: unknown) => unknown }) =>
    options.select({ location: { publicHref: router.publicHref } }),
}))

function languageAt(publicHref: string) {
  router.publicHref = publicHref
  const hook = renderHook(useUrlLanguage)
  const language = hook.current
  hook.unmount()
  return language
}

describe("useUrlLanguage", () => {
  it("is English on an unprefixed address", () => {
    expect(languageAt("/rules")).toBe("en")
  })

  it("reads the prefix off the address", () => {
    expect(languageAt("/pt/rules")).toBe("pt")
    expect(languageAt("/ja")).toBe("ja")
  })

  it("ignores a query string and a hash", () => {
    expect(languageAt("/de/rules?x=1")).toBe("de")
    expect(languageAt("/fr#chapter")).toBe("fr")
  })

  it("does not take an unknown prefix for a language", () => {
    expect(languageAt("/xx/rules")).toBe("en")
  })
})
