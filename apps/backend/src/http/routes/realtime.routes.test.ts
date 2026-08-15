import { env } from "cloudflare:workers"
import { beforeAll, describe, expect, it } from "vitest"
import worker from "@/entrypoint"
import { envRegistry } from "@/env/registry"
import type { RealtimeEvent } from "@/modules/realtime/events"
import { mintTicket } from "@/modules/realtime/ticket"
import { newExecutionContext } from "@/test-support/execution-context"

type Envelope<Data> = {
  status: string
  error_code?: string
  data?: Data
}

type Ticket = { ticket: string; expiresAt: number }

describe("realtime routes", () => {
  beforeAll(() => {
    envRegistry.setEnv(env as unknown as Record<string, unknown>)
  })

  function fetchWorker(request: Request) {
    return worker.fetch(request, env as never, newExecutionContext())
  }

  //---- a player, and the ticket they can buy ----------------

  let handles = 0
  async function signUp() {
    handles += 1
    const username = `listener${handles}`
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
    const token = response.headers.get("set-auth-token") ?? ""

    const session = await fetchWorker(
      new Request("http://example.com/api/v1/auth/get-session", {
        headers: {
          authorization: `Bearer ${token}`,
          "x-test-bypass": "true",
        },
      }),
    )
    const resolved = (await session.json()) as { user?: { id: string } }

    return { token, userId: resolved.user?.id ?? "" }
  }

  async function buyTicket(token: string) {
    const response = await fetchWorker(
      new Request("http://example.com/api/v1/realtime/ticket", {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          origin: "http://example.com",
          "x-test-bypass": "true",
        },
      }),
    )
    return {
      response,
      body: (await response.json()) as Envelope<Ticket>,
    }
  }

  function subscribe(query: string) {
    return fetchWorker(
      new Request(`http://example.com/api/v1/realtime?${query}`, {
        headers: {
          upgrade: "websocket",
          origin: "http://example.com",
          "x-test-bypass": "true",
        },
      }),
    )
  }

  function publishTo(channel: string, payload: RealtimeEvent) {
    const stub = env.PUBSUB.get(env.PUBSUB.idFromName(channel))
    return stub.publish(payload)
  }

  /** The socket, and everything it has been told so far. */
  function listen(socket: WebSocket) {
    const frames: RealtimeEvent[] = []
    socket.accept()
    socket.addEventListener("message", (message) => {
      frames.push(JSON.parse(String(message.data)) as RealtimeEvent)
    })
    return frames
  }

  /** Waits for the socket to have been told `count` things. */
  async function waitForFrames(frames: RealtimeEvent[], count: number) {
    for (
      let attempt = 0;
      attempt < 100 && frames.length < count;
      attempt++
    ) {
      await scheduler.wait(10)
    }
    return frames
  }

  //---- buying a ticket ----------------

  it("refuses to mint one for a guest", async () => {
    const { response, body } = await buyTicket("")

    expect(response.status).toBe(401)
    expect(body.error_code).toBe("unauthorized")
  })

  it("mints one for a signed-in player", async () => {
    const player = await signUp()
    const { response, body } = await buyTicket(player.token)

    expect(response.status).toBe(201)
    expect(body.data?.ticket).toContain(".")
    expect(body.data?.expiresAt).toBeGreaterThan(Date.now())
  })

  //---- redeeming one ----------------

  it("refuses a request that is not an upgrade", async () => {
    const player = await signUp()
    const { body } = await buyTicket(player.token)

    const response = await fetchWorker(
      new Request(
        `http://example.com/api/v1/realtime?ticket=${body.data?.ticket}`,
        { headers: { "x-test-bypass": "true" } },
      ),
    )

    expect(response.status).toBe(400)
  })

  it("refuses an upgrade with no ticket", async () => {
    const response = await subscribe("")

    expect(response.status).toBe(401)
    expect(response.webSocket).toBeNull()
  })

  it("refuses a forged ticket", async () => {
    const response = await subscribe("ticket=not.aticket")

    expect(response.status).toBe(401)
  })

  it("refuses a ticket signed with another secret", async () => {
    const { ticket } = await mintTicket(
      "an-entirely-different-secret",
      "player-a",
      "user:player-a",
    )
    const response = await subscribe(`ticket=${ticket}`)

    expect(response.status).toBe(401)
  })

  it("refuses an origin that is not the frontend", async () => {
    const player = await signUp()
    const { body } = await buyTicket(player.token)

    const response = await fetchWorker(
      new Request(
        `http://example.com/api/v1/realtime?ticket=${body.data?.ticket}`,
        {
          headers: {
            upgrade: "websocket",
            origin: "http://attacker.example.net",
            "x-test-bypass": "true",
          },
        },
      ),
    )

    expect(response.status).toBe(401)
  })

  it("upgrades a good ticket and delivers that channel's beacons", async () => {
    const player = await signUp()
    const { body } = await buyTicket(player.token)

    const response = await subscribe(`ticket=${body.data?.ticket}`)
    expect(response.status).toBe(101)

    const socket = response.webSocket
    if (!socket) throw new Error("no socket on the 101")
    const frames = listen(socket)

    await publishTo(`user:${player.userId}`, { event: "games-changed" })
    await waitForFrames(frames, 1)

    expect(frames).toEqual([{ event: "games-changed" }])
  })

  //---- the invariant ----------------
  //THE REGRESSION GUARD. the channel is a signed claim, so a request cannot ask
  //for one. if this ever fails, a player can listen to somebody else's events by
  //redeeming their own ticket against a channel they named — read ticket.ts.

  it("ignores a channel the request names, and uses the ticket's", async () => {
    const player = await signUp()
    const intruder = await signUp()
    const { body } = await buyTicket(player.token)

    //every shape a hopeful client might try, all at once
    const response = await subscribe(
      `ticket=${body.data?.ticket}` +
        `&channel=user:${intruder.userId}` +
        `&c=user:${intruder.userId}`,
    )
    expect(response.status).toBe(101)

    const socket = response.webSocket
    if (!socket) throw new Error("no socket on the 101")
    const frames = listen(socket)

    //the channel it asked for, then the one it is actually on. the second is
    //what proves the socket is alive, so the silence about the first is real
    //silence rather than a race.
    await publishTo(`user:${intruder.userId}`, {
      event: "invites-changed",
    })
    await publishTo(`user:${player.userId}`, {
      event: "game-updated",
      meta: { gameId: "g1", moveCount: 3 },
    })
    await waitForFrames(frames, 1)

    expect(frames).toEqual([
      { event: "game-updated", meta: { gameId: "g1", moveCount: 3 } },
    ])
  })
})
