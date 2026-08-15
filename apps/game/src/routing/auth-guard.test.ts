import { afterEach, describe, expect, it, vi } from "vitest"
import { needsSignIn, signInPrompt } from "@/routing/auth-guard"

//the store is stubbed rather than borrowed from the environment: what this
//guard is about is the two places it runs, and the interesting one is a worker
//that has no `localStorage` at all. an environment that always provides one
//cannot express that case.
function withStore(token: string | null) {
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => (key === "abalone.bearer" ? token : null),
  })
}

const DESKTOP = true
const PHONE = false

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("needsSignIn", () => {
  it("sends a guest to sign in", () => {
    withStore(null)
    expect(needsSignIn()).toBe(true)
  })

  it("lets a device holding a token through", () => {
    withStore("a-live-token")
    expect(needsSignIn()).toBe(false)
  })

  //the regression. a hard load of an online route is answered by a worker that
  //runs the router with no `localStorage`, so a guard that reads the token
  //there sees a guest every time and answers the document with a redirect —
  //every reload and every pasted link bounced to the login screen, with the
  //signed-in device never getting far enough to disagree.
  it("does not judge where there is no window to judge from", () => {
    withStore(null)
    vi.stubGlobal("window", undefined)
    expect(needsSignIn()).toBe(false)
  })
})

describe("signInPrompt", () => {
  it("asks a signed-in player for nothing, on either shape", () => {
    withStore("a-live-token")
    expect(signInPrompt(DESKTOP)).toBe("none")
    expect(signInPrompt(PHONE)).toBe("none")
  })

  it("sends a guest on a desktop to the login screen", () => {
    withStore(null)
    expect(signInPrompt(DESKTOP)).toBe("login-screen")
  })

  //a phone must never LAND on the login screen. the form belongs in a drawer
  //over the screen it was asked from, which is the split `AuthPromptProvider`
  //already applies to every ask that starts from a tap — a guard that went
  //straight to `/login` would be a second, contradictory answer.
  it("gives a guest on a phone the drawer", () => {
    withStore(null)
    expect(signInPrompt(PHONE)).toBe("drawer")
  })
})
