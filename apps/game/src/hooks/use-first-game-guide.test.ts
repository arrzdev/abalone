import { act } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { FirstGameGuideInput } from "@/hooks/use-first-game-guide"
import { useFirstGameGuide } from "@/hooks/use-first-game-guide"
import { stubMemoryStorage } from "@/test-support/memory-storage"
import { renderHookWithProps } from "@/test-support/render-hook-with-props"
import {
  GUIDE_STORAGE_KEY,
  isGuideDone,
  resetGuide,
} from "@/utils/first-game-guide"

const playing: FirstGameGuideInput = {
  mode: "ai",
  phase: "ingame",
  selectedCount: 0,
  moveCount: 1,
  currentTurn: "black",
  botColor: "white",
  gameOver: false,
  besideBoard: true,
}

function mount(input: Partial<FirstGameGuideInput> = {}) {
  return renderHookWithProps(useFirstGameGuide, { ...playing, ...input })
}

describe("useFirstGameGuide", () => {
  beforeEach(() => {
    stubMemoryStorage()
    //the flag is also remembered in module state, which storage alone does not clear
    resetGuide()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("opens on the first step of a first game", () => {
    const hook = mount()
    expect(hook.current.step).toBe("select")
    hook.unmount()
  })

  it("shows nothing to someone who has finished it", () => {
    localStorage.setItem(GUIDE_STORAGE_KEY, "done")
    const hook = mount()
    expect(hook.current.step).toBeNull()
    hook.unmount()
  })

  //an online game has someone waiting on the other side
  it("shows nothing online", () => {
    const hook = mount({ mode: "online" })
    expect(hook.current.step).toBeNull()
    hook.unmount()
  })

  //under the board a step's title and text would take the board's room
  it("shows nothing when the panel is under the board", () => {
    const hook = mount({ besideBoard: false })
    expect(hook.current.step).toBeNull()
    hook.unmount()
  })

  it("shows nothing outside a game in play", () => {
    const hook = mount({ phase: "pregame" })
    expect(hook.current.step).toBeNull()
    hook.unmount()
  })

  it("moves on to the direction step when the player selects marbles", () => {
    const hook = mount()
    hook.rerender({ ...playing, selectedCount: 2 })
    expect(hook.current.step).toBe("direction")
    hook.unmount()
  })

  it("goes back a step when the selection is cleared", () => {
    const hook = mount()
    hook.rerender({ ...playing, selectedCount: 2 })
    hook.rerender({ ...playing, selectedCount: 0 })
    expect(hook.current.step).toBe("select")
    hook.unmount()
  })

  //the bot's move shows its own marbles selected while it animates
  it("ignores a selection that is the bot's, not the player's", () => {
    const hook = mount({ currentTurn: "white" })
    hook.rerender({ ...playing, currentTurn: "white", selectedCount: 2 })
    expect(hook.current.step).toBe("select")
    hook.unmount()
  })

  //"How to move" on a board with marbles already picked still starts at step 1
  it("does not count marbles that were already selected when it mounted", () => {
    const hook = mount({ selectedCount: 3 })
    expect(hook.current.step).toBe("select")
    hook.unmount()
  })

  it("jumps to the goal when the player's move lands", () => {
    const hook = mount()
    hook.rerender({ ...playing, moveCount: 2, currentTurn: "white" })
    expect(hook.current.step).toBe("win")
    hook.unmount()
  })

  it("does not take the bot's move for the player learning", () => {
    const hook = mount({ currentTurn: "white" })
    //the bot (white) had the turn and moved, so black is up now
    hook.rerender({ ...playing, moveCount: 2, currentTurn: "black" })
    expect(hook.current.step).toBe("select")
    hook.unmount()
  })

  it("steps through on next, and next past the goal ends it for good", () => {
    const hook = mount()
    act(() => hook.current.next())
    //next on step 1 jumps to the goal: nothing is selected after it
    expect(hook.current.step).toBe("win")

    act(() => hook.current.next())
    expect(hook.current.step).toBeNull()
    expect(isGuideDone()).toBe(true)
    hook.unmount()
  })

  it("remembers a skip", () => {
    const hook = mount()
    act(() => hook.current.skip())
    expect(hook.current.step).toBeNull()
    expect(localStorage.getItem(GUIDE_STORAGE_KEY)).toBe("done")
    hook.unmount()
  })

  it("counts the game ending as the end of the guide", () => {
    const hook = mount()
    hook.rerender({ ...playing, phase: "postgame", gameOver: true })
    expect(isGuideDone()).toBe(true)
    hook.unmount()
  })

  it("starts over from step one when the guide is reset", () => {
    const hook = mount()
    act(() => hook.current.skip())
    expect(hook.current.step).toBeNull()

    act(() => resetGuide())

    expect(hook.current.step).toBe("select")
    hook.unmount()
  })

  it("starts a new game on the first step again", () => {
    const hook = mount()
    hook.rerender({ ...playing, selectedCount: 2 })
    expect(hook.current.step).toBe("direction")

    hook.rerender({ ...playing, phase: "pregame" })
    hook.rerender({ ...playing, phase: "ingame" })

    expect(hook.current.step).toBe("select")
    hook.unmount()
  })
})
