import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { getBearerToken, writeToken } from "@/data/auth/token"
import { backendBaseUrl } from "@/data/backend-client"
import {
  gameMovesQueryOptions,
  gameQueryOptions,
  gamesQueryOptions,
  INVITE_POLL_MS,
  inviteLinkQueryOptions,
  invitesQueryOptions,
  onlineKeys,
} from "@/data/online/queries"
import { stubMemoryStorage } from "@/test-support/memory-storage"
import { runQuery } from "@/test-support/run-query"
import { jsonResponse, stubFetch } from "@/test-support/stub-fetch"

//the reads behind the online hub and the board: which url each one asks, what
//it hands back from the envelope, how a refusal surfaces, and how each is
//cached. the network is a stubbed `fetch`.

const API = `${backendBaseUrl}/api/v1`

function success(data: unknown): Response {
  return jsonResponse(200, { status: "success", data })
}

function failure(status: number, errorCode: string): Response {
  return jsonResponse(status, { status: "error", error_code: errorCode })
}

describe("online queries", () => {
  beforeEach(() => {
    stubMemoryStorage()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe("onlineKeys", () => {
    it("keys every read by what it asks for", () => {
      expect(onlineKeys.invites).toEqual(["online", "invites"])
      expect(onlineKeys.games("active")).toEqual([
        "online",
        "games",
        "active",
      ])
      expect(onlineKeys.game("g1")).toEqual(["online", "game", "g1"])
      expect(onlineKeys.moves("g1")).toEqual([
        "online",
        "game",
        "g1",
        "moves",
      ])
      expect(onlineKeys.inviteLink("l1")).toEqual([
        "online",
        "invite-link",
        "l1",
      ])
    })

    it("keeps the write key under the game's own key, apart from its reads", () => {
      expect(onlineKeys.write("g1").slice(0, 3)).toEqual(
        onlineKeys.game("g1"),
      )
      expect(onlineKeys.write("g1")).not.toEqual(onlineKeys.moves("g1"))
    })
  })

  describe("invitesQueryOptions", () => {
    it("lists the invites from the envelope, with the bearer token", async () => {
      writeToken("tok")
      const network = stubFetch(() =>
        success({ invites: [{ id: "i1" }, { id: "i2" }] }),
      )

      const invites = await runQuery(invitesQueryOptions)

      expect(invites).toEqual([{ id: "i1" }, { id: "i2" }])
      expect(network.last().method).toBe("GET")
      expect(network.last().url).toBe(`${API}/invites`)
      expect(network.last().headers.get("authorization")).toBe(
        "Bearer tok",
      )
    })

    it("polls on the invite interval", () => {
      expect(invitesQueryOptions.refetchInterval).toBe(INVITE_POLL_MS)
      expect(invitesQueryOptions.staleTime).toBe(INVITE_POLL_MS)
    })

    it("throws the error code of a refusal", async () => {
      stubFetch(() => failure(429, "rate_limit_exceeded"))
      await expect(runQuery(invitesQueryOptions)).rejects.toThrow(
        "rate_limit_exceeded",
      )
    })

    it("ends the session when the server says unauthorized", async () => {
      writeToken("dead")
      stubFetch(() => failure(401, "unauthorized"))

      await expect(runQuery(invitesQueryOptions)).rejects.toThrow(
        "unauthorized",
      )

      expect(getBearerToken()).toBe("")
    })
  })

  describe("gamesQueryOptions", () => {
    it("asks for the status it was given", async () => {
      const network = stubFetch(() => success({ games: [{ id: "g1" }] }))

      expect(await runQuery(gamesQueryOptions("finished"))).toEqual([
        { id: "g1" },
      ])

      expect(network.last().url).toBe(`${API}/games?status=finished`)
    })

    it("keeps looking at the active list", () => {
      const options = gamesQueryOptions("active")
      expect(options.queryKey).toEqual(onlineKeys.games("active"))
      expect(options.staleTime).toBe(INVITE_POLL_MS)
      expect(options.refetchInterval).toBe(INVITE_POLL_MS)
    })

    it("believes history once it has asked", () => {
      const options = gamesQueryOptions("finished")
      expect(options.staleTime).toBe(Number.POSITIVE_INFINITY)
      expect(options.refetchInterval).toBe(false)
    })
  })

  describe("gameQueryOptions", () => {
    it("reads one game's row by id", async () => {
      const network = stubFetch(() => success({ game: { id: "g1" } }))

      expect(await runQuery(gameQueryOptions("g1"))).toEqual({ id: "g1" })
      expect(network.last().url).toBe(`${API}/games/g1`)
    })

    it("throws the error code when the game is not found", async () => {
      stubFetch(() => failure(404, "not_found"))
      await expect(runQuery(gameQueryOptions("nope"))).rejects.toThrow(
        "not_found",
      )
    })
  })

  describe("gameMovesQueryOptions", () => {
    it("reads every ply of the game", async () => {
      const network = stubFetch(() =>
        success({ moves: [{ index: 0 }, { index: 1 }] }),
      )

      expect(await runQuery(gameMovesQueryOptions("g1"))).toEqual([
        { index: 0 },
        { index: 1 },
      ])
      expect(network.last().url).toBe(`${API}/games/g1/moves`)
    })

    it("is never stale and never polled", () => {
      const options = gameMovesQueryOptions("g1")
      expect(options.staleTime).toBe(Number.POSITIVE_INFINITY)
      expect(options).not.toHaveProperty("refetchInterval")
    })
  })

  describe("inviteLinkQueryOptions", () => {
    it("reads the link as it is for whoever opened it", async () => {
      const network = stubFetch(() =>
        success({ inviterName: "Ada", state: "open" }),
      )

      expect(await runQuery(inviteLinkQueryOptions("abc"))).toEqual({
        inviterName: "Ada",
        state: "open",
      })
      expect(network.last().url).toBe(`${API}/invite-links/abc`)
    })

    it("answers a link nobody issued as broken instead of failing", async () => {
      stubFetch(() => failure(404, "not_found"))

      expect(await runQuery(inviteLinkQueryOptions("abc"))).toEqual({
        inviterName: null,
        state: "broken",
      })
    })

    it("fails on any other refusal so the page can offer a retry", async () => {
      stubFetch(() => failure(503, "service_unavailable"))

      await expect(
        runQuery(inviteLinkQueryOptions("abc")),
      ).rejects.toThrow("service_unavailable")
    })

    it("is never fresh", () => {
      expect(inviteLinkQueryOptions("abc").staleTime).toBe(0)
    })
  })

  it("surfaces network_unreachable when the request never lands", async () => {
    stubFetch(() => {
      throw new TypeError("failed to fetch")
    })

    await expect(runQuery(gameQueryOptions("g1"))).rejects.toThrow(
      "network_unreachable",
    )
  })
})
