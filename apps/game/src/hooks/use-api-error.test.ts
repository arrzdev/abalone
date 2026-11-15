import { describe, expect, it, vi } from "vitest"
import { useApiError } from "@/hooks/use-api-error"
import { renderHook } from "@/test-support/render-hook"

//the key is the contract: what the hook hands to `t` is what a screen shows
//once the namespace resolves it, so an echo stand-in is enough to read it
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => `t(${key})` }),
}))

describe("useApiError", () => {
  it("translates the key for an error code the api answered with", () => {
    const hook = renderHook(useApiError)
    expect(hook.current(new Error("not_your_turn"))).toBe(
      "t(errors:api_not_your_turn)",
    )
    hook.unmount()
  })

  it("has its own sentence for a request that never landed", () => {
    const hook = renderHook(useApiError)
    expect(hook.current(new Error("network_unreachable"))).toBe(
      "t(errors:network_unreachable)",
    )
    hook.unmount()
  })

  it("says something went wrong for a code it has never heard of", () => {
    const hook = renderHook(useApiError)
    expect(hook.current(new Error("brand_new_code"))).toBe(
      "t(errors:unknown)",
    )
    hook.unmount()
  })

  it("says the same for something that is not an Error at all", () => {
    const hook = renderHook(useApiError)
    expect(hook.current("not_your_turn")).toBe("t(errors:unknown)")
    expect(hook.current(undefined)).toBe("t(errors:unknown)")
    hook.unmount()
  })
})
