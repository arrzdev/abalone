import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { stubMemoryStorage } from "@/test-support/memory-storage"
import type { GuideProgress } from "@/utils/first-game-guide"
import {
  advanceGuide,
  GUIDE_STORAGE_KEY,
  guideStepNumber,
  isGuideDone,
  isGuidedStart,
  markGuideDone,
  resetGuide,
  shouldGuide,
  startsOnBoard,
} from "@/utils/first-game-guide"

//the guide is three steps on the real board: pick marbles, pick where they go,
//then the goal. the first two move on when the player does the thing, every
//step moves on with Next, and Skip ends it from anywhere.
describe("advanceGuide", () => {
  it("moves from picking marbles to choosing a direction once one is picked", () => {
    expect(advanceGuide("select", { type: "selected", count: 1 })).toBe(
      "direction",
    )
    expect(advanceGuide("select", { type: "selected", count: 3 })).toBe(
      "direction",
    )
  })

  it("stays on picking marbles while nothing is picked", () => {
    expect(advanceGuide("select", { type: "selected", count: 0 })).toBe(
      "select",
    )
  })

  it("goes back to picking marbles when the player lets go of them", () => {
    expect(advanceGuide("direction", { type: "selected", count: 0 })).toBe(
      "select",
    )
  })

  it("stays on choosing a direction while the player changes what is picked", () => {
    expect(advanceGuide("direction", { type: "selected", count: 2 })).toBe(
      "direction",
    )
  })

  it("moves to the goal once the player has made a move", () => {
    expect(advanceGuide("direction", { type: "moved" })).toBe("win")
  })

  //a move is a selection and a direction in one, so a player who gets there
  //some other way (a drag, the keyboard) has done both steps
  it("skips to the goal when a move lands while still on picking marbles", () => {
    expect(advanceGuide("select", { type: "moved" })).toBe("win")
  })

  it("stays on the goal when more moves are played", () => {
    expect(advanceGuide("win", { type: "moved" })).toBe("win")
    expect(advanceGuide("win", { type: "selected", count: 2 })).toBe("win")
  })

  it("moves one step on with Next, and ends after the last", () => {
    expect(advanceGuide("select", { type: "next" })).toBe("direction")
    expect(advanceGuide("direction", { type: "next" })).toBe("win")
    expect(advanceGuide("win", { type: "next" })).toBe("done")
  })

  it("ends from every step with Skip", () => {
    for (const step of ["select", "direction", "win"] as const)
      expect(advanceGuide(step, { type: "skip" })).toBe("done")
  })

  //the guide is for the first game; once that game is over it has done its job
  it("ends when the game it is shown on is over", () => {
    for (const step of ["select", "direction", "win"] as const)
      expect(advanceGuide(step, { type: "game_over" })).toBe("done")
  })

  it("stays ended whatever happens next", () => {
    const events = [
      { type: "selected", count: 1 },
      { type: "moved" },
      { type: "next" },
      { type: "skip" },
      { type: "game_over" },
    ] as const
    for (const event of events)
      expect(advanceGuide("done" as GuideProgress, event)).toBe("done")
  })
})

describe("guideStepNumber", () => {
  it("numbers the steps one to three in the order they are shown", () => {
    expect(guideStepNumber("select")).toBe(1)
    expect(guideStepNumber("direction")).toBe(2)
    expect(guideStepNumber("win")).toBe(3)
  })
})

describe("shouldGuide", () => {
  it("guides a first game against the computer or on one device", () => {
    expect(shouldGuide("ai", false)).toBe(true)
    expect(shouldGuide("local", false)).toBe(true)
  })

  it("never guides an online game", () => {
    expect(shouldGuide("online", false)).toBe(false)
  })

  it("does not guide a player who has finished or skipped it", () => {
    expect(shouldGuide("ai", true)).toBe(false)
    expect(shouldGuide("local", true)).toBe(false)
  })
})

//a first game against the computer skips the setup screen: Gus, the standard
//layout and black are the defaults it would show anyway, and the guide teaches
//on the board. Pass & Play keeps its setup, because the names are asked there.
describe("startsOnBoard", () => {
  it("opens a first game against the computer on the board", () => {
    expect(startsOnBoard("ai", false)).toBe(true)
  })

  it("opens the setup screen once the guide is finished or skipped", () => {
    expect(startsOnBoard("ai", true)).toBe(false)
  })

  it("always opens Pass & Play on its setup screen", () => {
    expect(startsOnBoard("local", false)).toBe(false)
    expect(startsOnBoard("local", true)).toBe(false)
  })

  it("never applies to an online game", () => {
    expect(startsOnBoard("online", false)).toBe(false)
  })
})

describe("the guide's saved flag", () => {
  beforeEach(() => {
    stubMemoryStorage()
    resetGuide()
  })

  afterEach(() => {
    resetGuide()
    vi.unstubAllGlobals()
  })

  it("is not done for a first-time visitor", () => {
    expect(isGuideDone()).toBe(false)
  })

  it("is saved under one versioned key", () => {
    markGuideDone()
    expect(localStorage.getItem(GUIDE_STORAGE_KEY)).toBe("done")
    expect(GUIDE_STORAGE_KEY).toBe("abalone.guide.v1")
    expect(isGuideDone()).toBe(true)
  })

  it("reads a flag saved by an earlier visit", () => {
    localStorage.setItem(GUIDE_STORAGE_KEY, "done")
    expect(isGuideDone()).toBe(true)
  })

  it("ignores a value it did not write", () => {
    localStorage.setItem(GUIDE_STORAGE_KEY, "maybe")
    expect(isGuideDone()).toBe(false)
  })

  //"How to move" in Settings
  it("is cleared again by a reset", () => {
    markGuideDone()
    resetGuide()
    expect(localStorage.getItem(GUIDE_STORAGE_KEY)).toBeNull()
    expect(isGuideDone()).toBe(false)
  })
})

//private mode: storage throws on every call. the guide must still work, and
//show at most once for as long as the page is open
describe("the guide's saved flag without storage", () => {
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
    resetGuide()
  })

  afterEach(() => {
    resetGuide()
    vi.unstubAllGlobals()
  })

  it("reads as not done without throwing", () => {
    expect(() => isGuideDone()).not.toThrow()
    expect(isGuideDone()).toBe(false)
  })

  it("remembers a finished guide for the rest of the session", () => {
    expect(() => markGuideDone()).not.toThrow()
    expect(isGuideDone()).toBe(true)
  })

  it("forgets it again on a reset", () => {
    markGuideDone()
    expect(() => resetGuide()).not.toThrow()
    expect(isGuideDone()).toBe(false)
  })
})

//the game start event says whether the guide is showing, so first games with
//the guide can be compared with games before it
describe("isGuidedStart", () => {
  beforeEach(() => {
    stubMemoryStorage()
    resetGuide()
  })

  afterEach(() => {
    resetGuide()
    vi.unstubAllGlobals()
  })

  it("is guided for a first offline game", () => {
    expect(isGuidedStart("ai")).toBe(true)
    expect(isGuidedStart("local")).toBe(true)
  })

  it("is not guided once the guide is finished or skipped", () => {
    markGuideDone()

    expect(isGuidedStart("ai")).toBe(false)
    expect(isGuidedStart("local")).toBe(false)
  })

  it("is guided again after How to move brings the guide back", () => {
    markGuideDone()
    resetGuide()

    expect(isGuidedStart("ai")).toBe(true)
  })

  it("is never guided online", () => {
    expect(isGuidedStart("online")).toBe(false)
  })
})
