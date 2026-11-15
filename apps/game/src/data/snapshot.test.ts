import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  clearSnapshot,
  readSnapshot,
  writeSnapshot,
} from "@/data/snapshot"
import { stubMemoryStorage } from "@/test-support/memory-storage"

//a snapshot is a cache the next cold start paints from. it must round-trip,
//and a bad value must read as "no snapshot" rather than crash the boot.

describe("local snapshots", () => {
  beforeEach(() => {
    stubMemoryStorage()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("reads back what was written", () => {
    writeSnapshot("key", { name: "ada", count: 2 })
    expect(readSnapshot("key")).toEqual({ name: "ada", count: 2 })
  })

  it("reads null for a key nothing was written to", () => {
    expect(readSnapshot("missing")).toBeNull()
  })

  it("reads null for a value that is not JSON any more", () => {
    localStorage.setItem("key", "{half-written")
    expect(readSnapshot("key")).toBeNull()
  })

  it("reads null for an empty stored value", () => {
    localStorage.setItem("key", "")
    expect(readSnapshot("key")).toBeNull()
  })

  it("forgets a snapshot once it is cleared", () => {
    writeSnapshot("key", [1, 2, 3])
    clearSnapshot("key")
    expect(readSnapshot("key")).toBeNull()
  })

  it("is inert without localStorage", () => {
    vi.stubGlobal("localStorage", undefined)

    expect(() => writeSnapshot("key", 1)).not.toThrow()
    expect(() => clearSnapshot("key")).not.toThrow()
    expect(readSnapshot("key")).toBeNull()
  })
})
