import { env } from "cloudflare:workers"
import { beforeAll, beforeEach, describe, expect, it } from "vitest"
import worker from "@/entrypoint"
import { envRegistry } from "@/env/registry"
import { resetRateLimitBuckets } from "@/http/middlewares/rate-limit"
import type { Game } from "@/services/game.service"
import { newExecutionContext } from "@/test-support/execution-context"

type Envelope<Data> = {
  status: string
  error_code?: string
  data?: Data
}

type CreatedLink = { url: string; expiresAt: number }
type PublicLink = {
  inviterName: string
  state: "open" | "used" | "expired"
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

//the token is the secret in the url: 32 random bytes, base64url, no padding
const LINK_PATH = /^\/invite\/([A-Za-z0-9_-]{43})$/

describe("invite link routes", () => {
  beforeAll(() => {
    envRegistry.setEnv(env as unknown as Record<string, unknown>)
  })

  beforeEach(() => {
    resetRateLimitBuckets()
  })

  //---- talking to the worker ----------------

  function fetchWorker(request: Request) {
    return worker.fetch(request, env as never, newExecutionContext())
  }

  type CallOptions = {
    body?: unknown
    origin?: string
    //off for the rate-limit tests, so their hits actually count
    bypass?: boolean
    ip?: string
  }

  async function call<Data>(
    method: string,
    path: string,
    token: string,
    options: CallOptions = {},
  ) {
    const headers: Record<string, string> = {
      origin: options.origin ?? "http://example.com",
    }
    if (options.bypass !== false) headers["x-test-bypass"] = "true"
    if (options.ip) headers["cf-connecting-ip"] = options.ip
    if (token) headers.authorization = `Bearer ${token}`
    if (options.body !== undefined)
      headers["content-type"] = "application/json"

    const response = await fetchWorker(
      new Request(`http://example.com/api/v1${path}`, {
        method,
        headers,
        body:
          options.body === undefined
            ? undefined
            : JSON.stringify(options.body),
      }),
    )
    return {
      response,
      body: (await response.json()) as Envelope<Data>,
    }
  }

  let handles = 0
  async function signUp(role: string) {
    handles += 1
    const username = `${role}${handles}`
    const response = await fetchWorker(
      new Request("http://example.com/api/v1/auth/sign-up/email", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://example.com",
          "x-test-bypass": "true",
        },
        body: JSON.stringify({
          username,
          name: username,
          email: `${username}@users.abalone.invalid`,
          password: "correct-horse",
        }),
      }),
    )
    return {
      username,
      token: response.headers.get("set-auth-token") ?? "",
    }
  }

  //---- the shortest path to a link ----------------

  function linkIdOf(url: string): string {
    const match = new URL(url).pathname.match(LINK_PATH)
    if (!match) throw new Error(`not an invite link: ${url}`)
    return match[1]
  }

  async function createLink(
    token: string,
    side: "black" | "white" | "random" = "black",
  ) {
    const { body } = await call<CreatedLink>(
      "POST",
      "/invite-links",
      token,
      {
        body: { setupType: "standard", side },
      },
    )
    if (!body.data) throw new Error(`create failed: ${body.error_code}`)
    return { ...body.data, id: linkIdOf(body.data.url) }
  }

  function accept(token: string, linkId: string) {
    return call<{ gameId: string }>(
      "POST",
      `/invite-links/${linkId}/accept`,
      token,
    )
  }

  function readLink(linkId: string) {
    return call<PublicLink>("GET", `/invite-links/${linkId}`, "")
  }

  //an expired link without waiting a week: the row is moved into the past
  async function expire(linkId: string) {
    await env.DB.prepare(
      "UPDATE invite_links SET expires_at = ? WHERE id = ?",
    )
      .bind(Date.now() - 1000, linkId)
      .run()
  }

  //a well-formed token that was never issued
  const UNKNOWN_ID = "A".repeat(43)

  //---- create ----------------

  describe("POST /invite-links", () => {
    it("refuses a signed-out caller", async () => {
      const { response, body } = await call("POST", "/invite-links", "", {
        body: { setupType: "standard", side: "black" },
      })
      expect(response.status).toBe(401)
      expect(body.error_code).toBe("unauthorized")
    })

    it("refuses terms that are not a game", async () => {
      const inviter = await signUp("inviter")
      const { response, body } = await call(
        "POST",
        "/invite-links",
        inviter.token,
        { body: { setupType: "no-such-setup", side: "green" } },
      )
      expect(response.status).toBe(400)
      expect(body.error_code).toBe("invalid_input")
    })

    it("hands back a link to the game that lasts a week", async () => {
      const inviter = await signUp("inviter")
      const before = Date.now()
      const { response, body } = await call<CreatedLink>(
        "POST",
        "/invite-links",
        inviter.token,
        { body: { setupType: "standard", side: "black" } },
      )

      expect(response.status).toBe(201)
      const url = new URL(body.data?.url ?? "")
      expect(url.origin).toBe("http://example.com")
      expect(url.pathname).toMatch(LINK_PATH)
      expect(body.data?.expiresAt).toBeGreaterThanOrEqual(before + WEEK_MS)
      expect(body.data?.expiresAt).toBeLessThanOrEqual(
        Date.now() + WEEK_MS,
      )
    })

    //production serves the game on more than one domain: a link made on one
    //opens on the same one
    it("points the link at the game origin that asked for it", async () => {
      const inviter = await signUp("inviter")
      const { body } = await call<CreatedLink>(
        "POST",
        "/invite-links",
        inviter.token,
        {
          body: { setupType: "standard", side: "black" },
          origin: "http://second.example.com",
        },
      )
      expect(new URL(body.data?.url ?? "").origin).toBe(
        "http://second.example.com",
      )
    })

    it("makes a new secret every time", async () => {
      const inviter = await signUp("inviter")
      const first = await createLink(inviter.token)
      const second = await createLink(inviter.token)
      expect(first.id).not.toBe(second.id)
    })

    it("sheds a flood of creates", async () => {
      const inviter = await signUp("inviter")
      const statuses: number[] = []
      for (let attempt = 0; attempt < 21; attempt += 1) {
        const { response } = await call(
          "POST",
          "/invite-links",
          inviter.token,
          {
            body: { setupType: "standard", side: "black" },
            bypass: false,
            ip: "203.0.113.10",
          },
        )
        statuses.push(response.status)
      }
      expect(statuses.slice(0, 20).every((status) => status === 201)).toBe(
        true,
      )
      expect(statuses[20]).toBe(429)
    })
  })

  //---- public read ----------------

  describe("GET /invite-links/:id", () => {
    it("tells anyone who sent it, and nothing else", async () => {
      const inviter = await signUp("inviter")
      const link = await createLink(inviter.token)

      const { response, body } = await readLink(link.id)
      expect(response.status).toBe(200)
      //exactly these two keys: no user id, no game, no terms, no dates
      expect(body.data).toEqual({
        inviterName: inviter.username,
        state: "open",
      })
    })

    it("answers not found for a link that was never made", async () => {
      const { response, body } = await readLink(UNKNOWN_ID)
      expect(response.status).toBe(404)
      expect(body.error_code).toBe("not_found")
    })

    it("says when a link has been used", async () => {
      const inviter = await signUp("inviter")
      const friend = await signUp("friend")
      const link = await createLink(inviter.token)
      await accept(friend.token, link.id)

      const { body } = await readLink(link.id)
      expect(body.data?.state).toBe("used")
    })

    it("says when a link has expired", async () => {
      const inviter = await signUp("inviter")
      const link = await createLink(inviter.token)
      await expire(link.id)

      const { body } = await readLink(link.id)
      expect(body.data?.state).toBe("expired")
    })
  })

  //---- accept ----------------

  describe("POST /invite-links/:id/accept", () => {
    it("refuses a signed-out caller", async () => {
      const inviter = await signUp("inviter")
      const link = await createLink(inviter.token)

      const { response, body } = await accept("", link.id)
      expect(response.status).toBe(401)
      expect(body.error_code).toBe("unauthorized")
    })

    it("opens a game between the two, on the terms the link was made with", async () => {
      const inviter = await signUp("inviter")
      const friend = await signUp("friend")
      const link = await createLink(inviter.token, "black")

      const { response, body } = await accept(friend.token, link.id)
      expect(response.status).toBe(201)
      const gameId = body.data?.gameId ?? ""

      //both seats can read it, with the inviter on the side they picked
      for (const player of [inviter, friend]) {
        const { response: read, body: game } = await call<{ game: Game }>(
          "GET",
          `/games/${gameId}`,
          player.token,
        )
        expect(read.status).toBe(200)
        expect(game.data?.game.black.username).toBe(inviter.username)
        expect(game.data?.game.white.username).toBe(friend.username)
        expect(game.data?.game.setupType).toBe("standard")
      }
    })

    //the game is between the two of them; a third account reading it is
    //somebody else's data and answers like it does not exist
    it("keeps the game away from anyone else", async () => {
      const inviter = await signUp("inviter")
      const friend = await signUp("friend")
      const stranger = await signUp("stranger")
      const link = await createLink(inviter.token)
      const { body } = await accept(friend.token, link.id)

      const { response, body: read } = await call(
        "GET",
        `/games/${body.data?.gameId}`,
        stranger.token,
      )
      expect(response.status).toBe(404)
      expect(read.error_code).toBe("not_found")
    })

    it("works once: a second player is told it is used", async () => {
      const inviter = await signUp("inviter")
      const friend = await signUp("friend")
      const latecomer = await signUp("latecomer")
      const link = await createLink(inviter.token)
      await accept(friend.token, link.id)

      const { response, body } = await accept(latecomer.token, link.id)
      expect(response.status).toBe(409)
      expect(body.error_code).toBe("invite_link_used")
    })

    //a dropped response or a reload after sign-up asks again. the player who
    //already used it gets the same game back, not an error and not a second game.
    it("gives the player who used it the same game again", async () => {
      const inviter = await signUp("inviter")
      const friend = await signUp("friend")
      const link = await createLink(inviter.token)
      const first = await accept(friend.token, link.id)

      const again = await accept(friend.token, link.id)
      expect(again.response.status).toBe(200)
      expect(again.body.data?.gameId).toBe(first.body.data?.gameId)
    })

    it("lets exactly one of two racing players in", async () => {
      const inviter = await signUp("inviter")
      const first = await signUp("first")
      const second = await signUp("second")
      const link = await createLink(inviter.token)

      const results = await Promise.all([
        accept(first.token, link.id),
        accept(second.token, link.id),
      ])
      const statuses = results
        .map((result) => result.response.status)
        .sort()
      expect(statuses).toEqual([201, 409])

      const { body } = await call<{ games: Game[] }>(
        "GET",
        "/games",
        inviter.token,
      )
      expect(body.data?.games).toHaveLength(1)
    })

    it("tells the inviter it is their own link, and leaves it open", async () => {
      const inviter = await signUp("inviter")
      const friend = await signUp("friend")
      const link = await createLink(inviter.token)

      const own = await accept(inviter.token, link.id)
      expect(own.response.status).toBe(400)
      expect(own.body.error_code).toBe("invite_link_own")

      const { body } = await readLink(link.id)
      expect(body.data?.state).toBe("open")
      const later = await accept(friend.token, link.id)
      expect(later.response.status).toBe(201)
    })

    it("refuses an expired link", async () => {
      const inviter = await signUp("inviter")
      const friend = await signUp("friend")
      const link = await createLink(inviter.token)
      await expire(link.id)

      const { response, body } = await accept(friend.token, link.id)
      expect(response.status).toBe(410)
      expect(body.error_code).toBe("invite_link_expired")
    })

    it("answers not found for a link that was never made", async () => {
      const friend = await signUp("friend")
      const { response, body } = await accept(friend.token, UNKNOWN_ID)
      expect(response.status).toBe(404)
      expect(body.error_code).toBe("not_found")
    })

    it("sheds a flood of accepts", async () => {
      const friend = await signUp("friend")
      const statuses: number[] = []
      for (let attempt = 0; attempt < 21; attempt += 1) {
        const { response } = await call(
          "POST",
          `/invite-links/${UNKNOWN_ID}/accept`,
          friend.token,
          { bypass: false, ip: "203.0.113.20" },
        )
        statuses.push(response.status)
      }
      expect(statuses.slice(0, 20).every((status) => status === 404)).toBe(
        true,
      )
      expect(statuses[20]).toBe(429)
    })
  })
})
