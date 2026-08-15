import type { ReactElement } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { SignedInOnly } from "@/routing/signed-in-only"

//called rather than rendered: the gate holds no state and runs no hooks, so
//what it returns IS its whole behaviour, and asserting on that needs no dom
function gate(returnTo: "/game/online") {
  return SignedInOnly({ returnTo, children: "the screen" })
}

function withStore(token: string | null) {
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => (key === "abalone.bearer" ? token : null),
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("SignedInOnly", () => {
  it("shows the screen to a signed-in player", () => {
    withStore("a-live-token")
    expect(gate("/game/online")).toBe("the screen")
  })

  //the regression. `beforeLoad` does not re-run on the client after a cold
  //load — the router hydrates the verdict the worker reached, and that worker
  //has no token store to reach it from. without this half, a guest opening a
  //pasted link stays on the online screen instead of being asked to sign in.
  it("sends a guest to the login screen with a way back", () => {
    withStore(null)
    const redirected = gate("/game/online") as ReactElement<{
      to: string
      search: { redirect: string }
      replace: boolean
    }>

    expect(redirected.props.to).toBe("/login")
    expect(redirected.props.search).toEqual({ redirect: "/game/online" })
    expect(redirected.props.replace).toBe(true)
  })
})
