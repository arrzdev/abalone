import { describe, expect, it } from "vitest"
import { toBase64Url } from "@/utils/base64url"

//invite link ids are this function's output, so what matters is that the
//result is url-safe as it stands: no `+`, no `/`, no padding.
describe("toBase64Url", () => {
  it("encodes bytes the way base64 does when no character needs swapping", () => {
    const bytes = new TextEncoder().encode("abalone")

    expect(toBase64Url(bytes)).toBe("YWJhbG9uZQ")
  })

  it("swaps + and / for - and _", () => {
    //0xfb 0xff 0xbf is "+/+/" in plain base64
    expect(toBase64Url(new Uint8Array([0xfb, 0xff, 0xbf]))).toBe("-_-_")
  })

  it("drops one and two characters of padding", () => {
    expect(toBase64Url(new Uint8Array([1, 2]))).toBe("AQI")
    expect(toBase64Url(new Uint8Array([1]))).toBe("AQ")
  })

  it("encodes no bytes as an empty string", () => {
    expect(toBase64Url(new Uint8Array())).toBe("")
  })

  it("turns 32 random bytes into 43 url-safe characters", () => {
    const encoded = toBase64Url(crypto.getRandomValues(new Uint8Array(32)))

    expect(encoded).toMatch(/^[A-Za-z0-9_-]{43}$/)
  })
})
