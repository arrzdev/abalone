import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { writeToken } from "@/data/auth/token"
import { backendBaseUrl } from "@/data/backend-client"
import {
  profileQueryKey,
  profileQueryOptions,
} from "@/data/profile/queries"
import {
  readProfileSnapshot,
  writeProfileSnapshot,
} from "@/data/profile/snapshot"
import { stubMemoryStorage } from "@/test-support/memory-storage"
import { runQuery } from "@/test-support/run-query"
import { jsonResponse, stubFetch } from "@/test-support/stub-fetch"

//the signed-in player's own profile: gated on auth, painted from a snapshot
//until the network answers, and the one writer of that snapshot.

const profile = {
  username: "ada",
  displayUsername: "Ada",
  avatarUrl: null,
}

describe("profileQueryOptions", () => {
  beforeEach(() => {
    stubMemoryStorage()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("reads /profile/me with the bearer token and returns the profile", async () => {
    writeToken("tok")
    const network = stubFetch(() =>
      jsonResponse(200, { status: "success", data: { profile } }),
    )

    expect(await runQuery(profileQueryOptions(true))).toEqual(profile)

    expect(network.last().method).toBe("GET")
    expect(network.last().url).toBe(`${backendBaseUrl}/api/v1/profile/me`)
    expect(network.last().headers.get("authorization")).toBe("Bearer tok")
  })

  it("keeps the fresh profile as the snapshot for the next cold start", async () => {
    stubFetch(() =>
      jsonResponse(200, { status: "success", data: { profile } }),
    )

    await runQuery(profileQueryOptions(true))

    expect(readProfileSnapshot()).toEqual(profile)
  })

  it("throws the code of a refusal and leaves the snapshot alone", async () => {
    stubFetch(() =>
      jsonResponse(503, {
        status: "error",
        error_code: "service_unavailable",
      }),
    )

    await expect(runQuery(profileQueryOptions(true))).rejects.toThrow(
      "service_unavailable",
    )
    expect(readProfileSnapshot()).toBeNull()
  })

  it("is keyed under profile/me", () => {
    expect(profileQueryOptions(true).queryKey).toEqual(profileQueryKey)
    expect(profileQueryKey).toEqual(["profile", "me"])
  })

  it("is enabled only for a signed-in player", () => {
    expect(profileQueryOptions(true).enabled).toBe(true)
    expect(profileQueryOptions(false).enabled).toBe(false)
  })

  describe("placeholder", () => {
    function placeholder(isAuthenticated: boolean): unknown {
      const { placeholderData } = profileQueryOptions(isAuthenticated)
      return typeof placeholderData === "function"
        ? (placeholderData as () => unknown)()
        : placeholderData
    }

    it("paints the stored profile for a signed-in player", () => {
      writeProfileSnapshot(profile)
      expect(placeholder(true)).toEqual(profile)
    })

    it("has nothing to paint when no snapshot was stored", () => {
      expect(placeholder(true)).toBeUndefined()
    })

    it("never paints a stored profile for a guest, so hydration matches", () => {
      writeProfileSnapshot(profile)
      expect(profileQueryOptions(false).placeholderData).toBeUndefined()
    })
  })
})
