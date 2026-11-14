import { runInDurableObject } from "cloudflare:test"
import { env } from "cloudflare:workers"
import { describe, expect, it, vi } from "vitest"
import type { RealtimeEvent } from "@/modules/realtime/events"

//the object on its own, reached the way the route reaches it: one object per
//channel, a fetch to subscribe and an rpc call to publish. who may subscribe is
//the route's question, and realtime.routes.test.ts asks it.

const gamesChanged: RealtimeEvent = { event: "games-changed" }
const invitesChanged: RealtimeEvent = { event: "invites-changed" }

let channels = 0
function newChannel() {
  channels += 1
  return `user:pubsub-test-${channels}`
}

function channelStub(channel: string) {
  return env.PUBSUB.get(env.PUBSUB.idFromName(channel))
}

/** Subscribes one socket to the channel, the way the route forwards it. */
async function connect(channel: string) {
  const response = await channelStub(channel).fetch(
    new Request("http://pubsub/", { headers: { upgrade: "websocket" } }),
  )
  return response
}

/** The socket, and everything it has been told so far. */
function listen(socket: WebSocket) {
  const frames: string[] = []
  socket.accept()
  socket.addEventListener("message", (message) => {
    frames.push(String(message.data))
  })
  return frames
}

async function subscribe(channel: string) {
  const response = await connect(channel)
  const socket = response.webSocket
  if (!socket) throw new Error("the object did not hand back a socket")
  return { socket, frames: listen(socket) }
}

function publish(channel: string, payload: RealtimeEvent) {
  return channelStub(channel).publish(payload, { channel })
}

/** Waits for the frames to reach `count`, or gives up after a second. */
async function waitForFrames(frames: string[], count: number) {
  for (
    let attempt = 0;
    attempt < 100 && frames.length < count;
    attempt++
  ) {
    await scheduler.wait(10)
  }
  return frames
}

/** Waits until the object holds exactly `count` sockets. */
async function waitForSubscribers(channel: string, count: number) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const held = await runInDurableObject(
      channelStub(channel),
      (_instance, state) => state.getWebSockets().length,
    )
    if (held === count) return held
    await scheduler.wait(10)
  }
  throw new Error(`the channel never settled on ${count} subscribers`)
}

describe("PubSub", () => {
  //---- subscribe ----------------

  it("answers a subscribe with a 101, a socket and only the ticket marker", async () => {
    const channel = newChannel()
    const response = await connect(channel)

    expect(response.status).toBe(101)
    expect(response.webSocket).not.toBeNull()
    //the marker, never the ticket that followed it
    expect(response.headers.get("sec-websocket-protocol")).toBe("ticket")
    await waitForSubscribers(channel, 1)
  })

  it("answers the keepalive without waking the object", async () => {
    const { socket, frames } = await subscribe(newChannel())

    socket.send("ping")

    expect(await waitForFrames(frames, 1)).toEqual(["pong"])
  })

  //---- publish ----------------

  it("sends a beacon to every socket on the channel", async () => {
    const channel = newChannel()
    const first = await subscribe(channel)
    const second = await subscribe(channel)
    const third = await subscribe(channel)

    await publish(channel, gamesChanged)

    for (const subscriber of [first, second, third]) {
      expect(await waitForFrames(subscriber.frames, 1)).toEqual([
        JSON.stringify(gamesChanged),
      ])
    }
  })

  it("keeps each channel's beacons to that channel", async () => {
    const mine = newChannel()
    const theirs = newChannel()
    const listener = await subscribe(mine)
    const other = await subscribe(theirs)

    await publish(theirs, invitesChanged)
    await publish(mine, gamesChanged)

    //the one beacon meant for this socket arrives, and nothing published
    //before it to the other channel came along
    expect(await waitForFrames(listener.frames, 1)).toEqual([
      JSON.stringify(gamesChanged),
    ])
    expect(await waitForFrames(other.frames, 1)).toEqual([
      JSON.stringify(invitesChanged),
    ])
  })

  it("does not let a subscriber move its socket to another channel", async () => {
    const mine = newChannel()
    const theirs = newChannel()
    const { socket, frames } = await subscribe(mine)

    //every shape a client might try: there is no message the object acts on
    socket.send(JSON.stringify({ subscribe: theirs }))
    socket.send(JSON.stringify({ channel: theirs, event: "join" }))
    socket.send(theirs)
    await publish(theirs, invitesChanged)
    await publish(mine, gamesChanged)

    expect(await waitForFrames(frames, 1)).toEqual([
      JSON.stringify(gamesChanged),
    ])
    //no socket was added to the other channel either
    expect(await waitForSubscribers(theirs, 0)).toBe(0)
  })

  it("still reaches the open sockets after one subscriber has closed", async () => {
    const channel = newChannel()
    const leaving = await subscribe(channel)
    const staying = await subscribe(channel)

    leaving.socket.close(1000, "bye")
    await waitForSubscribers(channel, 1)
    await publish(channel, gamesChanged)

    expect(await waitForFrames(staying.frames, 1)).toEqual([
      JSON.stringify(gamesChanged),
    ])
    expect(leaving.frames).toEqual([])
  })

  it("does not fail a publish when a socket it still holds cannot be sent to", async () => {
    const channel = newChannel()
    await subscribe(channel)

    //closed from the object's side, so the runtime still lists it but a send
    //to it throws: the case broadcast() must stand up to
    await runInDurableObject(channelStub(channel), (_instance, state) => {
      for (const socket of state.getWebSockets())
        socket.close(1011, "gone")
    })
    const staying = await subscribe(channel)
    const warnings = vi.spyOn(console, "warn").mockImplementation(() => {})
    await expect(publish(channel, gamesChanged)).resolves.toBeUndefined()

    expect(await waitForFrames(staying.frames, 1)).toEqual([
      JSON.stringify(gamesChanged),
    ])
    warnings.mockRestore()
  })

  it("resolves a publish to a channel with no subscribers", async () => {
    const channel = newChannel()

    await expect(publish(channel, gamesChanged)).resolves.toBeUndefined()
    expect(await waitForSubscribers(channel, 0)).toBe(0)
  })

  //---- close ----------------

  it("answers a close with no code as a normal close, and keeps a real code", async () => {
    const calls: [number | undefined, string | undefined][] = []
    const socket = {
      close: (code?: number, reason?: string) => {
        calls.push([code, reason])
      },
    } as unknown as WebSocket

    await runInDurableObject(
      channelStub(newChannel()),
      async (instance) => {
        await instance.webSocketClose(socket, 1005, "")
        await instance.webSocketClose(socket, 1006, "dropped")
        await instance.webSocketClose(socket, 4000, "custom")
      },
    )

    expect(calls).toEqual([
      [1000, ""],
      [1000, "dropped"],
      [4000, "custom"],
    ])
  })

  it("survives a socket that is already closed when the close arrives", async () => {
    const socket = {
      close: () => {
        throw new Error("already closed")
      },
    } as unknown as WebSocket

    await runInDurableObject(
      channelStub(newChannel()),
      async (instance) => {
        await expect(
          instance.webSocketClose(socket, 1000, "bye"),
        ).resolves.toBeUndefined()
      },
    )
  })
})
