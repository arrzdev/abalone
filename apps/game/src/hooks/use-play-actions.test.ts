import { PLAYABLE_SETUPS } from "@repo/abalone-engine/board-setups"
import { createGameState } from "@repo/abalone-engine/game-state"
import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  COMPUTER_GAME,
  computerGameOn,
  usePlayActions,
} from "@/hooks/use-play-actions"
import { renderHook } from "@/test-support/render-hook"

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  requireAuth: vi.fn(),
}))

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mocks.navigate,
}))
vi.mock("@/providers/auth-prompt-provider", () => ({
  useAuthPrompt: () => ({ requireAuth: mocks.requireAuth }),
}))

//the starting positions page offers a game on each layout it draws: the same
//route and search as any computer game (so it is counted as one), with the
//layout asked for beside the request to start on the board.
describe("computerGameOn", () => {
  it.each(["standard", "belgian_daisy", "german_daisy"] as const)(
    "goes where the computer game goes, asking for %s",
    (setup) => {
      const game = computerGameOn(setup)
      expect(game.to).toBe(COMPUTER_GAME.to)
      expect(game.search).toEqual(COMPUTER_GAME.search)
      expect(game.state).toEqual({ startOnBoard: true, setup })
    },
  )

  it.each(PLAYABLE_SETUPS)("%s opens with 14 marbles a side", (setup) => {
    const { black, white, setupType } = createGameState(
      setup,
      "black",
      "ai",
    )
    expect(setupType).toBe(setup)
    expect(black.size).toBe(14)
    expect(white.size).toBe(14)
  })

  it("leaves the plain computer game on the default layout", () => {
    expect(COMPUTER_GAME.state).toEqual({ startOnBoard: true })
  })
})

describe("usePlayActions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("plays the computer on the board, the same way every play link does", () => {
    const hook = renderHook(usePlayActions)
    hook.current.playComputer()
    expect(mocks.navigate).toHaveBeenCalledWith(COMPUTER_GAME)
    hook.unmount()
  })

  it("takes the mode as far as the url when the caller knows it", () => {
    const hook = renderHook(usePlayActions)
    hook.current.playOffline("local")
    expect(mocks.navigate).toHaveBeenCalledWith({
      to: "/offline",
      search: { mode: "local" },
      state: { startOnBoard: true },
    })
    hook.unmount()
  })

  //the home page's single "play offline" has no mode to offer
  it("leaves the mode for the setup panel to ask when none is given", () => {
    const hook = renderHook(usePlayActions)
    hook.current.playOffline()
    expect(mocks.navigate).toHaveBeenCalledWith({
      to: "/offline",
      search: { mode: undefined },
      state: { startOnBoard: true },
    })
    hook.unmount()
  })

  //online needs an account, so signing in is a step on the way there
  it("asks for sign-in on the way to the hub rather than navigating", () => {
    const hook = renderHook(usePlayActions)
    hook.current.playOnline()
    expect(mocks.requireAuth).toHaveBeenCalledWith({ redirect: "/online" })
    expect(mocks.navigate).not.toHaveBeenCalled()
    hook.unmount()
  })
})
