import { ERROR_CODES } from "@repo/backend/http/errors"
import { describe, expect, it } from "vitest"
import { API_ERROR_KEYS, apiErrorKey } from "@/i18n/api-errors"

//the english errors namespace, read the way vite bundles it
const LOCALES = import.meta.glob<Record<string, string>>(
  "./locales/*/errors.json",
  { eager: true, import: "default" },
)

describe("API_ERROR_KEYS", () => {
  //the `satisfies` in the source catches this at compile time; the runtime
  //check also catches a key that points at nothing in the locale files
  it("has a key for every code the backend can answer with", () => {
    expect(Object.keys(API_ERROR_KEYS).sort()).toEqual(
      Object.keys(ERROR_CODES).sort(),
    )
  })

  describe.each(Object.keys(LOCALES))("%s", (path) => {
    it("resolves every key to a sentence", () => {
      const strings = LOCALES[path]
      const keys = [
        ...Object.values(API_ERROR_KEYS),
        "errors:network_unreachable",
        "errors:unknown",
      ]
      for (const key of keys) {
        const name = key.slice("errors:".length)
        expect(strings[name], key).toEqual(expect.any(String))
      }
    })
  })
})

describe("apiErrorKey", () => {
  it("maps an api error code, carried as the message, to its key", () => {
    expect(apiErrorKey(new Error("not_your_turn"))).toBe(
      "errors:api_not_your_turn",
    )
    expect(apiErrorKey(new Error("unauthorized"))).toBe(
      "errors:api_unauthorized",
    )
  })

  it("maps the sentinel for a request that never landed", () => {
    expect(apiErrorKey(new Error("network_unreachable"))).toBe(
      "errors:network_unreachable",
    )
  })

  it("falls back to the unknown sentence for a code it has no key for", () => {
    expect(apiErrorKey(new Error("something_new"))).toBe("errors:unknown")
  })

  it("falls back for anything that is not an error", () => {
    expect(apiErrorKey("not_your_turn")).toBe("errors:unknown")
    expect(apiErrorKey(null)).toBe("errors:unknown")
    expect(apiErrorKey(undefined)).toBe("errors:unknown")
    expect(apiErrorKey(new Error(""))).toBe("errors:unknown")
  })
})
