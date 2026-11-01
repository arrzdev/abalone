import { env } from "cloudflare:workers"
import { beforeAll, describe, expect, it } from "vitest"
import worker from "@/entrypoint"
import { envRegistry } from "@/env/registry"
import type { Invite } from "@/services/invite.service"
import { newExecutionContext } from "@/test-support/execution-context"

type Envelope<Data> = {
  status: string
  error_code?: string
  data?: Data
}

/**
 * Who may see, decline and delete an invite.
 *
 * Every refusal here answers `not_found`, not a 403: an invite the caller is not
 * party to looks the same as one that never existed, so the answer leaks
 * nothing about invites between other players.
 */
describe("invite routes", () => {
  beforeAll(() => {
    envRegistry.setEnv(env as unknown as Record<string, unknown>)
  })

  //---- talking to the worker ----------------

  function fetchWorker(request: Request) {
    return worker.fetch(request, env as never, newExecutionContext())
  }

  async function call<Data>(
    method: string,
    path: string,
    token: string,
    body?: unknown,
  ) {
    const headers: Record<string, string> = {
      origin: "http://example.com",
      "x-test-bypass": "true",
    }
    if (token) headers.authorization = `Bearer ${token}`
    if (body !== undefined) headers["content-type"] = "application/json"

    const response = await fetchWorker(
      new Request(`http://example.com/api/v1${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
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

  //---- the shortest path to an invite ----------------

  async function invite(from: string, username: string) {
    const { body } = await call<{ invite: Invite }>(
      "POST",
      "/invites",
      from,
      { username, setupType: "standard", side: "black" },
    )
    if (!body.data) throw new Error(`invite failed: ${body.error_code}`)
    return body.data.invite
  }

  /** A sender, a recipient, an invite pending between them, and a stranger. */
  async function pendingInvite() {
    const sender = await signUp("sender")
    const recipient = await signUp("recipient")
    const stranger = await signUp("stranger")
    const sent = await invite(sender.token, recipient.username)
    return { sender, recipient, stranger, sent }
  }

  function decline(token: string, inviteId: string) {
    return call<{ invite: Invite }>(
      "PATCH",
      `/invites/${inviteId}`,
      token,
      {
        status: "declined",
      },
    )
  }

  function remove(token: string, inviteId: string) {
    return call("DELETE", `/invites/${inviteId}`, token)
  }

  async function listFor(token: string) {
    const { body } = await call<{ invites: Invite[] }>(
      "GET",
      "/invites",
      token,
    )
    return body.data?.invites ?? []
  }

  //a well-formed id that was never issued
  const UNKNOWN_ID = "00000000-0000-4000-8000-000000000000"

  //---- signed out ----------------

  describe("without a session", () => {
    it.each([
      ["GET", "/invites", undefined],
      [
        "POST",
        "/invites",
        { username: "anyone", setupType: "standard", side: "black" },
      ],
      ["PATCH", `/invites/${UNKNOWN_ID}`, { status: "declined" }],
      ["DELETE", `/invites/${UNKNOWN_ID}`, undefined],
    ])("refuses %s %s", async (method, path, body) => {
      const { response, body: envelope } = await call(
        method,
        path,
        "",
        body,
      )

      expect(response.status).toBe(401)
      expect(envelope.error_code).toBe("unauthorized")
    })
  })

  //---- list ----------------

  describe("GET /invites", () => {
    it("shows an invite to both sides", async () => {
      const { sender, recipient, sent } = await pendingInvite()

      const theirs = await listFor(recipient.token)
      const mine = await listFor(sender.token)

      expect(theirs.map((each) => each.id)).toEqual([sent.id])
      expect(mine.map((each) => each.id)).toEqual([sent.id])
    })

    it("hides an invite from a player who is party to neither side", async () => {
      const { stranger } = await pendingInvite()

      expect(await listFor(stranger.token)).toEqual([])
    })

    it("lists sent and received invites oldest first", async () => {
      const player = await signUp("busy")
      const friend = await signUp("friend")
      const rival = await signUp("rival")
      const sent = await invite(player.token, friend.username)
      const received = await invite(rival.token, player.username)
      //two sends can land in the same millisecond, so the order is set by hand
      await env.DB.prepare(
        "UPDATE invites SET created_at = ? WHERE id = ?",
      )
        .bind(sent.createdAt - 1000, sent.id)
        .run()

      const ids = (await listFor(player.token)).map((each) => each.id)

      expect(ids).toEqual([sent.id, received.id])
    })
  })

  //---- send ----------------

  describe("POST /invites", () => {
    it("sends an invite on the terms asked for", async () => {
      const sender = await signUp("caller")
      const recipient = await signUp("callee")

      const { response, body } = await call<{ invite: Invite }>(
        "POST",
        "/invites",
        sender.token,
        {
          username: recipient.username,
          setupType: "belgian_daisy",
          side: "white",
        },
      )

      expect(response.status).toBe(201)
      expect(body.data?.invite).toMatchObject({
        setupType: "belgian_daisy",
        side: "white",
        status: "pending",
        from: { name: sender.username },
        to: { name: recipient.username },
      })
    })

    it("finds a player whatever case the handle was typed in", async () => {
      const sender = await signUp("typist")
      const recipient = await signUp("target")

      const { response } = await call("POST", "/invites", sender.token, {
        username: `  ${recipient.username.toUpperCase()} `,
        setupType: "standard",
        side: "random",
      })

      expect(response.status).toBe(201)
    })

    it.each([
      ["a handle too short", { username: "ab" }],
      ["a handle too long", { username: "a".repeat(21) }],
      ["a setup nobody plays", { setupType: "no-such-setup" }],
      ["a side that is not one", { side: "green" }],
    ])("refuses %s", async (_, override) => {
      const sender = await signUp("sloppy")

      const { response, body } = await call(
        "POST",
        "/invites",
        sender.token,
        {
          username: "someone",
          setupType: "standard",
          side: "black",
          ...override,
        },
      )

      expect(response.status).toBe(400)
      expect(body.error_code).toBe("invalid_input")
    })

    it("refuses an invite to a handle nobody holds", async () => {
      const sender = await signUp("lonely")

      const { response, body } = await call(
        "POST",
        "/invites",
        sender.token,
        {
          username: "nobody-at-all",
          setupType: "standard",
          side: "black",
        },
      )

      expect(response.status).toBe(404)
      expect(body.error_code).toBe("player_not_found")
    })

    it("refuses an invite to yourself", async () => {
      const solo = await signUp("solo")

      const { response, body } = await call(
        "POST",
        "/invites",
        solo.token,
        {
          username: solo.username,
          setupType: "standard",
          side: "black",
        },
      )

      expect(response.status).toBe(400)
      expect(body.error_code).toBe("invite_self")
    })

    it("refuses a second invite to the same player while one is pending", async () => {
      const { sender, recipient } = await pendingInvite()

      const { response, body } = await call(
        "POST",
        "/invites",
        sender.token,
        {
          username: recipient.username,
          setupType: "standard",
          side: "black",
        },
      )

      expect(response.status).toBe(409)
      expect(body.error_code).toBe("invite_exists")
      expect(await listFor(recipient.token)).toHaveLength(1)
    })

    //one row per direction: the other player asking back is a second invite
    it("lets the recipient invite the sender back", async () => {
      const { sender, recipient } = await pendingInvite()

      const { response } = await call(
        "POST",
        "/invites",
        recipient.token,
        {
          username: sender.username,
          setupType: "standard",
          side: "white",
        },
      )

      expect(response.status).toBe(201)
      expect(await listFor(sender.token)).toHaveLength(2)
    })

    it("lets the sender ask again after a decline, on the same row", async () => {
      const { sender, recipient, sent } = await pendingInvite()
      await decline(recipient.token, sent.id)

      const again = await call<{ invite: Invite }>(
        "POST",
        "/invites",
        sender.token,
        {
          username: recipient.username,
          setupType: "the_wall",
          side: "white",
        },
      )

      expect(again.response.status).toBe(201)
      expect(again.body.data?.invite).toMatchObject({
        id: sent.id,
        status: "pending",
        setupType: "the_wall",
        side: "white",
      })
      expect(await listFor(recipient.token)).toHaveLength(1)
    })
  })

  //---- decline ----------------

  describe("PATCH /invites/:id", () => {
    it("lets the recipient decline", async () => {
      const { sender, recipient, sent } = await pendingInvite()

      const { response, body } = await decline(recipient.token, sent.id)

      expect(response.status).toBe(200)
      expect(body.data?.invite).toMatchObject({
        id: sent.id,
        status: "declined",
      })
      const [seen] = await listFor(sender.token)
      expect(seen.status).toBe("declined")
    })

    it("refuses the sender declining their own invite", async () => {
      const { sender, recipient, sent } = await pendingInvite()

      const { response, body } = await decline(sender.token, sent.id)

      expect(response.status).toBe(404)
      expect(body.error_code).toBe("not_found")
      const [seen] = await listFor(recipient.token)
      expect(seen.status).toBe("pending")
    })

    it("refuses a player who is party to neither side", async () => {
      const { recipient, stranger, sent } = await pendingInvite()

      const { response, body } = await decline(stranger.token, sent.id)

      expect(response.status).toBe(404)
      expect(body.error_code).toBe("not_found")
      const [seen] = await listFor(recipient.token)
      expect(seen.status).toBe("pending")
    })

    it("refuses declining an invite twice", async () => {
      const { recipient, sent } = await pendingInvite()
      await decline(recipient.token, sent.id)

      const { response, body } = await decline(recipient.token, sent.id)

      expect(response.status).toBe(404)
      expect(body.error_code).toBe("not_found")
    })

    it("refuses an invite that does not exist", async () => {
      const player = await signUp("hopeful")

      const { response, body } = await decline(player.token, UNKNOWN_ID)

      expect(response.status).toBe(404)
      expect(body.error_code).toBe("not_found")
    })

    it("refuses an id that is not one", async () => {
      const player = await signUp("garbled")

      const { response, body } = await decline(player.token, "not-a-uuid")

      expect(response.status).toBe(400)
      expect(body.error_code).toBe("invalid_input")
    })

    //decline is the only change a recipient can make: nothing else gets in
    it.each([
      ["any other status", { status: "accepted" }],
      ["no status at all", {}],
    ])("refuses %s", async (_, patch) => {
      const { recipient, sent } = await pendingInvite()

      const { response, body } = await call(
        "PATCH",
        `/invites/${sent.id}`,
        recipient.token,
        patch,
      )

      expect(response.status).toBe(400)
      expect(body.error_code).toBe("invalid_input")
      const [seen] = await listFor(recipient.token)
      expect(seen.status).toBe("pending")
    })
  })

  //---- delete ----------------

  describe("DELETE /invites/:id", () => {
    it("lets the sender take an invite back", async () => {
      const { sender, recipient, sent } = await pendingInvite()

      const { response } = await remove(sender.token, sent.id)

      expect(response.status).toBe(200)
      expect(await listFor(recipient.token)).toEqual([])
      expect(await listFor(sender.token)).toEqual([])
    })

    it("lets the sender clear a decline", async () => {
      const { sender, recipient, sent } = await pendingInvite()
      await decline(recipient.token, sent.id)

      const { response } = await remove(sender.token, sent.id)

      expect(response.status).toBe(200)
      expect(await listFor(sender.token)).toEqual([])
    })

    it("refuses the recipient deleting an invite sent to them", async () => {
      const { sender, recipient, sent } = await pendingInvite()

      const { response, body } = await remove(recipient.token, sent.id)

      expect(response.status).toBe(404)
      expect(body.error_code).toBe("not_found")
      expect(await listFor(sender.token)).toHaveLength(1)
    })

    it("refuses a player who is party to neither side", async () => {
      const { sender, stranger, sent } = await pendingInvite()

      const { response, body } = await remove(stranger.token, sent.id)

      expect(response.status).toBe(404)
      expect(body.error_code).toBe("not_found")
      expect(await listFor(sender.token)).toHaveLength(1)
    })

    it("refuses an invite that does not exist", async () => {
      const player = await signUp("tidy")

      const { response, body } = await remove(player.token, UNKNOWN_ID)

      expect(response.status).toBe(404)
      expect(body.error_code).toBe("not_found")
    })

    it("refuses an id that is not one", async () => {
      const player = await signUp("garbled")

      const { response, body } = await remove(player.token, "not-a-uuid")

      expect(response.status).toBe(400)
      expect(body.error_code).toBe("invalid_input")
    })
  })
})
