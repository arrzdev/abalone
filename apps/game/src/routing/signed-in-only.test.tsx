import { act } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { writeToken } from "@/data/auth/token"
import { SignedInOnly } from "@/routing/signed-in-only"
import { stubMemoryStorage } from "@/test-support/memory-storage"
import { renderHook } from "@/test-support/render-hook"

//the guard that runs on a cold load: a guest never sees the screen, is sent
//home, and is asked to sign in with the page they wanted as the way back.
//the router and the prompt are the guard's neighbours, so they are stood in.
const neighbours = vi.hoisted(() => ({
  navigate: vi.fn(),
  requireAuth: vi.fn(),
}))

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => neighbours.navigate,
}))
vi.mock("@/providers/auth-prompt-provider", () => ({
  useAuthPrompt: () => ({ requireAuth: neighbours.requireAuth }),
}))

const SCREEN = "the screen"

function mount() {
  return renderHook(() =>
    SignedInOnly({ returnTo: "/online/history", children: SCREEN }),
  )
}

describe("SignedInOnly", () => {
  beforeEach(() => {
    stubMemoryStorage()
    neighbours.navigate.mockClear()
    neighbours.requireAuth.mockClear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("renders the screen for a signed-in player and asks nothing", () => {
    writeToken("token")

    const view = mount()

    expect(view.current).toBe(SCREEN)
    expect(neighbours.navigate).not.toHaveBeenCalled()
    expect(neighbours.requireAuth).not.toHaveBeenCalled()
    view.unmount()
  })

  it("renders nothing for a guest, sends them home and asks them to sign in", () => {
    const view = mount()

    expect(view.current).toBeNull()
    expect(neighbours.navigate).toHaveBeenCalledWith({
      to: "/",
      replace: true,
    })
    expect(neighbours.requireAuth).toHaveBeenCalledWith({
      redirect: "/online/history",
    })
    view.unmount()
  })

  it("lets the screen in when the player signs in afterwards", () => {
    const view = mount()
    expect(view.current).toBeNull()

    act(() => writeToken("token"))

    expect(view.current).toBe(SCREEN)
    view.unmount()
  })

  it("takes the screen away when the token is dropped", () => {
    writeToken("token")
    const view = mount()
    expect(view.current).toBe(SCREEN)

    act(() => writeToken(null))

    expect(view.current).toBeNull()
    expect(neighbours.requireAuth).toHaveBeenCalledTimes(1)
    view.unmount()
  })
})
