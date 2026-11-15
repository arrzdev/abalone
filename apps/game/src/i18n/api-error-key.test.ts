import { describe, expect, it } from "vitest"
import { apiErrorKey } from "@/i18n/api-errors"

describe("apiErrorKey", () => {
  it("maps a code the api can return to its key", () => {
    expect(apiErrorKey(new Error("forbidden_origin"))).toBe(
      "errors:api_forbidden_origin",
    )
  })

  it("keeps the sentinel for a request that never landed", () => {
    expect(apiErrorKey(new Error("network_unreachable"))).toBe(
      "errors:network_unreachable",
    )
  })

  it("answers unknown for a code it does not know, or for no error", () => {
    expect(apiErrorKey(new Error("something_new"))).toBe("errors:unknown")
    expect(apiErrorKey("boom")).toBe("errors:unknown")
    expect(apiErrorKey(undefined)).toBe("errors:unknown")
  })

  it("answers unknown for a message that is a property every object has", () => {
    for (const message of [
      "toString",
      "constructor",
      "__proto__",
      "hasOwnProperty",
    ])
      expect(apiErrorKey(new Error(message))).toBe("errors:unknown")
  })
})
