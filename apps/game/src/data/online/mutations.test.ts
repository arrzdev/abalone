import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { getBearerToken, writeToken } from "@/data/auth/token"
import { backendBaseUrl } from "@/data/backend-client"
import type { PlayMoveInput } from "@/data/online/mutations"
import {
  acceptInviteLinkMutationOptions,
  acceptInviteMutationOptions,
  createInviteLinkMutationOptions,
  declineInviteMutationOptions,
  MoveRefusedError,
  playMoveMutationOptions,
  removeInviteMutationOptions,
  resignGameMutationOptions,
  sendInviteMutationOptions,
} from "@/data/online/mutations"
import { stubMemoryStorage } from "@/test-support/memory-storage"
import { runMutation } from "@/test-support/run-query"
import { jsonResponse, stubFetch } from "@/test-support/stub-fetch"

//the writes behind the online screens: what each one sends, what it hands back
//out of the envelope, and how a refusal surfaces. the network is a stubbed
//`fetch`. a move is the one with a rule of its own: a 4xx means it was never
//played, anything else may be an answer lost after it was.

const API = `${backendBaseUrl}/api/v1`

function success(data: unknown): Response {
  return jsonResponse(200, { status: "success", data })
}

function failure(status: number, errorCode: string): Response {
  return jsonResponse(status, { status: "error", error_code: errorCode })
}

describe("online mutations", () => {
  beforeEach(() => {
    stubMemoryStorage()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe("sendInviteMutationOptions", () => {
    it("posts the terms and returns the invite", async () => {
      writeToken("tok")
      const network = stubFetch(() => success({ invite: { id: "i1" } }))
      const input = {
        username: "ada",
        setupType: "standard",
        side: "random",
      } as const

      const invite = await runMutation(sendInviteMutationOptions, input)

      expect(invite).toEqual({ id: "i1" })
      expect(network.last().method).toBe("POST")
      expect(network.last().url).toBe(`${API}/invites`)
      expect(network.last().json).toEqual(input)
      expect(network.last().headers.get("authorization")).toBe(
        "Bearer tok",
      )
    })

    it("throws the code of a refusal", async () => {
      stubFetch(() => failure(404, "player_not_found"))

      await expect(
        runMutation(sendInviteMutationOptions, {
          username: "nobody",
          setupType: "standard",
          side: "black",
        }),
      ).rejects.toThrow("player_not_found")
    })
  })

  describe("createInviteLinkMutationOptions", () => {
    it("posts the terms and returns the url and expiry", async () => {
      const network = stubFetch(() =>
        success({ url: "https://x.test/invite/abc", expiresAt: 99 }),
      )

      const created = await runMutation(createInviteLinkMutationOptions, {
        setupType: "standard",
        side: "white",
      })

      expect(created).toEqual({
        url: "https://x.test/invite/abc",
        expiresAt: 99,
      })
      expect(network.last().url).toBe(`${API}/invite-links`)
      expect(network.last().json).toEqual({
        setupType: "standard",
        side: "white",
      })
    })
  })

  describe("acceptInviteLinkMutationOptions", () => {
    it("posts to the link's accept route and returns the game id", async () => {
      const network = stubFetch(() => success({ gameId: "g1" }))

      expect(
        await runMutation(acceptInviteLinkMutationOptions, "abc"),
      ).toEqual({ gameId: "g1" })
      expect(network.last().method).toBe("POST")
      expect(network.last().url).toBe(`${API}/invite-links/abc/accept`)
    })

    it("throws the code when the link was already taken", async () => {
      stubFetch(() => failure(409, "invite_link_used"))

      await expect(
        runMutation(acceptInviteLinkMutationOptions, "abc"),
      ).rejects.toThrow("invite_link_used")
    })
  })

  describe("declineInviteMutationOptions", () => {
    it("patches the invite to declined", async () => {
      const network = stubFetch(() =>
        success({ invite: { id: "i1", status: "declined" } }),
      )

      const invite = await runMutation(declineInviteMutationOptions, "i1")

      expect(invite).toEqual({ id: "i1", status: "declined" })
      expect(network.last().method).toBe("PATCH")
      expect(network.last().url).toBe(`${API}/invites/i1`)
      expect(network.last().json).toEqual({ status: "declined" })
    })
  })

  describe("removeInviteMutationOptions", () => {
    it("deletes the invite and resolves to nothing", async () => {
      const network = stubFetch(() => success(null))

      expect(
        await runMutation(removeInviteMutationOptions, "i1"),
      ).toBeUndefined()
      expect(network.last().method).toBe("DELETE")
      expect(network.last().url).toBe(`${API}/invites/i1`)
    })

    it("throws the code of a refusal", async () => {
      stubFetch(() => failure(404, "not_found"))

      await expect(
        runMutation(removeInviteMutationOptions, "i1"),
      ).rejects.toThrow("not_found")
    })
  })

  describe("acceptInviteMutationOptions", () => {
    it("opens a game from the invite id", async () => {
      const network = stubFetch(() => success({ game: { id: "g1" } }))

      expect(await runMutation(acceptInviteMutationOptions, "i1")).toEqual(
        { id: "g1" },
      )
      expect(network.last().method).toBe("POST")
      expect(network.last().url).toBe(`${API}/games`)
      expect(network.last().json).toEqual({ inviteId: "i1" })
    })
  })

  describe("resignGameMutationOptions", () => {
    it("posts a resignation and returns the settled game", async () => {
      const network = stubFetch(() =>
        success({ game: { id: "g1", status: "finished" } }),
      )

      expect(await runMutation(resignGameMutationOptions, "g1")).toEqual({
        id: "g1",
        status: "finished",
      })
      expect(network.last().url).toBe(`${API}/games/g1/resignation`)
    })
  })

  describe("playMoveMutationOptions", () => {
    const move: PlayMoveInput = {
      gameId: "g1",
      marbles: ["a1", "b2"],
      destination: "c3",
      moveIndex: 4,
    }

    it("posts the move without the game id in its body", async () => {
      const network = stubFetch(() => success({ game: { id: "g1" } }))

      expect(await runMutation(playMoveMutationOptions, move)).toEqual({
        id: "g1",
      })
      expect(network.last().method).toBe("POST")
      expect(network.last().url).toBe(`${API}/games/g1/moves`)
      expect(network.last().json).toEqual({
        marbles: ["a1", "b2"],
        destination: "c3",
        moveIndex: 4,
      })
    })

    it("treats a 4xx as a move that was never played", async () => {
      stubFetch(() => failure(409, "move_conflict"))

      const error = await runMutation(playMoveMutationOptions, move).catch(
        (caught: unknown) => caught,
      )

      expect(error).toBeInstanceOf(MoveRefusedError)
      expect((error as Error).message).toBe("move_conflict")
    })

    it("treats a 5xx as an unknown outcome, not a refusal", async () => {
      stubFetch(() => failure(500, "internal_server_error"))

      const error = await runMutation(playMoveMutationOptions, move).catch(
        (caught: unknown) => caught,
      )

      expect(error).not.toBeInstanceOf(MoveRefusedError)
      expect((error as Error).message).toBe("internal_server_error")
    })

    it("treats a dropped connection as an unknown outcome too", async () => {
      stubFetch(() => {
        throw new TypeError("failed to fetch")
      })

      const error = await runMutation(playMoveMutationOptions, move).catch(
        (caught: unknown) => caught,
      )

      expect(error).not.toBeInstanceOf(MoveRefusedError)
      expect((error as Error).message).toBe("network_unreachable")
    })
  })

  it("ends the session when a write is answered unauthorized", async () => {
    writeToken("dead")
    stubFetch(() => failure(401, "unauthorized"))

    await expect(
      runMutation(resignGameMutationOptions, "g1"),
    ).rejects.toThrow("unauthorized")

    expect(getBearerToken()).toBe("")
  })
})
