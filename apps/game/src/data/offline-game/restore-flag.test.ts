import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  clearOfflineRestoreFlag,
  OFFLINE_RESTORE_ATTRIBUTE,
  OFFLINE_RESTORE_SCRIPT,
} from "@/data/offline-game/restore-flag"
import { OFFLINE_GAME_KEY } from "@/data/offline-game/snapshot"
import { stubMemoryStorage } from "@/test-support/memory-storage"

//the script is written into the document head as text, so it is run here the
//way a browser would: as source, against whatever location and storage the
//test arranged.

function runScript(pathname: string): void {
  vi.stubGlobal("location", { pathname })
  new Function(OFFLINE_RESTORE_SCRIPT)()
}

function isFlagged(): boolean {
  return document.documentElement.hasAttribute(OFFLINE_RESTORE_ATTRIBUTE)
}

function saveGame(saved: unknown): void {
  localStorage.setItem(OFFLINE_GAME_KEY, JSON.stringify(saved))
}

describe("offline restore flag", () => {
  beforeEach(() => {
    stubMemoryStorage()
  })

  afterEach(() => {
    clearOfflineRestoreFlag()
    vi.unstubAllGlobals()
  })

  it("flags /offline when the save is a live game", () => {
    saveGame({ state: { gameOver: false } })
    runScript("/offline")
    expect(isFlagged()).toBe(true)
  })

  it("flags /offline under any language prefix and with a trailing slash", () => {
    saveGame({ state: { gameOver: false } })
    runScript("/pt/offline/")
    expect(isFlagged()).toBe(true)
  })

  it("does not flag a save of a finished game", () => {
    saveGame({ state: { gameOver: true } })
    runScript("/offline")
    expect(isFlagged()).toBe(false)
  })

  it("does not flag when nothing was saved", () => {
    runScript("/offline")
    expect(isFlagged()).toBe(false)
  })

  it("does not flag any other page, whatever is saved", () => {
    saveGame({ state: { gameOver: false } })
    runScript("/rules")
    runScript("/online/offline-ish")
    expect(isFlagged()).toBe(false)
  })

  it("swallows a save that is not JSON", () => {
    localStorage.setItem(OFFLINE_GAME_KEY, "{broken")
    expect(() => runScript("/offline")).not.toThrow()
    expect(isFlagged()).toBe(false)
  })

  it("clearOfflineRestoreFlag lifts the flag", () => {
    document.documentElement.setAttribute(OFFLINE_RESTORE_ATTRIBUTE, "")
    clearOfflineRestoreFlag()
    expect(isFlagged()).toBe(false)
  })

  it("clearing with no flag set is harmless", () => {
    expect(() => clearOfflineRestoreFlag()).not.toThrow()
  })
})
