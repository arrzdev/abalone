import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  clearProfileSnapshot,
  readProfileSnapshot,
  writeProfileSnapshot,
} from "@/data/profile/snapshot"
import { stubMemoryStorage } from "@/test-support/memory-storage"

const profile = {
  username: "ada",
  displayUsername: "Ada",
  avatarUrl: "https://cdn.example.test/ada.webp",
}

describe("profile snapshot", () => {
  beforeEach(() => {
    stubMemoryStorage()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("is null until a profile has been written", () => {
    expect(readProfileSnapshot()).toBeNull()
  })

  it("reads back the profile that was written", () => {
    writeProfileSnapshot(profile)
    expect(readProfileSnapshot()).toEqual(profile)
  })

  it("is dropped when the session ends", () => {
    writeProfileSnapshot(profile)
    clearProfileSnapshot()
    expect(readProfileSnapshot()).toBeNull()
  })

  it("stores under the key the session end clears", () => {
    writeProfileSnapshot(profile)
    expect(localStorage.getItem("abalone.profile")).toBe(
      JSON.stringify(profile),
    )
  })
})
