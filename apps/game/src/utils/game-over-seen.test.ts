import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { stubMemoryStorage } from "@/test-support/memory-storage"
import {
  GAME_OVER_SEEN_KEY,
  GAME_OVER_SEEN_LIMIT,
  hasSeenGameOver,
  markGameOverSeen,
  resetGameOverSeen,
} from "@/utils/game-over-seen"

//the result sheet is news once: a finished game opened again goes straight to
//the board and its record
describe("the result sheet's seen games", () => {
  beforeEach(() => {
    stubMemoryStorage()
    resetGameOverSeen()
  })

  afterEach(() => {
    resetGameOverSeen()
    vi.unstubAllGlobals()
  })

  it("has not seen a game it was never told about", () => {
    expect(hasSeenGameOver("game-1")).toBe(false)
  })

  it("has seen a game once it is marked", () => {
    markGameOverSeen("game-1")
    expect(hasSeenGameOver("game-1")).toBe(true)
    expect(hasSeenGameOver("game-2")).toBe(false)
  })

  it("is saved as a list under one key, newest last", () => {
    markGameOverSeen("game-1")
    markGameOverSeen("game-2")
    markGameOverSeen("game-1")
    expect(
      JSON.parse(localStorage.getItem(GAME_OVER_SEEN_KEY) ?? ""),
    ).toEqual(["game-2", "game-1"])
    expect(GAME_OVER_SEEN_KEY).toBe("abalone_game_over_seen")
  })

  it("reads a list saved by an earlier visit", () => {
    localStorage.setItem(GAME_OVER_SEEN_KEY, JSON.stringify(["game-1"]))
    expect(hasSeenGameOver("game-1")).toBe(true)
  })

  it("ignores a value it did not write", () => {
    localStorage.setItem(GAME_OVER_SEEN_KEY, "{not json")
    expect(hasSeenGameOver("game-1")).toBe(false)
    expect(() => markGameOverSeen("game-1")).not.toThrow()
    expect(hasSeenGameOver("game-1")).toBe(true)
  })

  it("keeps the newest games once the list is full", () => {
    for (let index = 0; index <= GAME_OVER_SEEN_LIMIT; index++)
      markGameOverSeen(`game-${index}`)
    resetMemoryOnly()

    const saved = JSON.parse(
      localStorage.getItem(GAME_OVER_SEEN_KEY) ?? "",
    )
    expect(saved).toHaveLength(GAME_OVER_SEEN_LIMIT)
    expect(hasSeenGameOver("game-0")).toBe(false)
    expect(hasSeenGameOver("game-1")).toBe(true)
    expect(hasSeenGameOver(`game-${GAME_OVER_SEEN_LIMIT}`)).toBe(true)
  })
})

//private mode: storage throws on every call. the sheet must still open, and at
//most once for as long as the page is open
describe("the result sheet's seen games without storage", () => {
  beforeEach(() => {
    const refuse = () => {
      throw new DOMException("storage is disabled", "SecurityError")
    }
    vi.stubGlobal("localStorage", {
      getItem: refuse,
      setItem: refuse,
      removeItem: refuse,
      clear: refuse,
    })
    resetGameOverSeen()
  })

  afterEach(() => {
    resetGameOverSeen()
    vi.unstubAllGlobals()
  })

  it("reads as not seen without throwing", () => {
    expect(() => hasSeenGameOver("game-1")).not.toThrow()
    expect(hasSeenGameOver("game-1")).toBe(false)
  })

  it("remembers a shown sheet for the rest of the session", () => {
    expect(() => markGameOverSeen("game-1")).not.toThrow()
    expect(hasSeenGameOver("game-1")).toBe(true)
  })
})

/** A new page load: the saved list stays, this load's memory of it goes. */
function resetMemoryOnly(): void {
  const saved = localStorage.getItem(GAME_OVER_SEEN_KEY)
  resetGameOverSeen()
  if (saved) localStorage.setItem(GAME_OVER_SEEN_KEY, saved)
}
