import { describe, expect, it, vi } from "vitest"
import type { SocketClass } from "@/data/realtime/channel"
import { openRealtimeChannel, parseEvent } from "@/data/realtime/channel"

vi.mock("@/data/realtime/ticket", () => ({
  mintTicket: async () => "a-ticket",
}))

//the channel is server-written, but a frame is still input: it arrives over a
//socket, from a build that may be older or newer than this one. anything not
//recognised has to be dropped rather than guessed at, because the alternative
//is an invalidation keyed on undefined.

const GAME_ID = "3f7b1c60-0000-4000-8000-000000000001"

function frame(payload: unknown) {
  return parseEvent(JSON.stringify(payload))
}

describe("parseEvent", () => {
  //---- frames worth acting on ----------------

  it("reads a game update", () => {
    expect(
      frame({
        event: "game-updated",
        meta: { gameId: GAME_ID, updatedAt: 1_700_000_000_000 },
      }),
    ).toEqual({
      event: "game-updated",
      meta: { gameId: GAME_ID, updatedAt: 1_700_000_000_000 },
    })
  })

  it("reads the two list beacons", () => {
    expect(frame({ event: "invites-changed" })).toEqual({
      event: "invites-changed",
    })
    expect(frame({ event: "games-changed" })).toEqual({
      event: "games-changed",
    })
  })

  //---- frames that are not news ----------------

  //the runtime answers our keepalive without ever waking the durable object,
  //so this arrives on a healthy connection and must not look like an event
  it("drops the keepalive answer", () => {
    expect(parseEvent("pong")).toBeNull()
  })

  it("drops anything that is not a string", () => {
    expect(parseEvent(new ArrayBuffer(8))).toBeNull()
    expect(parseEvent(null)).toBeNull()
    expect(parseEvent(undefined)).toBeNull()
  })

  it("drops a frame that is not json", () => {
    expect(parseEvent("{ not json")).toBeNull()
  })

  it("drops an event this build does not know", () => {
    expect(frame({ event: "tournament-started" })).toBeNull()
    expect(frame({})).toBeNull()
    expect(frame([])).toBeNull()
  })

  //---- a game update that cannot be acted on ----------------
  //the meta IS the payload here: without both fields there is no key to
  //invalidate and no version to compare, so a partial one is worse than none

  it("drops a game update missing its meta", () => {
    expect(frame({ event: "game-updated" })).toBeNull()
    expect(frame({ event: "game-updated", meta: {} })).toBeNull()
  })

  it("drops a game update whose meta is the wrong shape", () => {
    expect(
      frame({ event: "game-updated", meta: { gameId: GAME_ID } }),
    ).toBeNull()
    expect(
      frame({ event: "game-updated", meta: { updatedAt: 1 } }),
    ).toBeNull()
    expect(
      frame({
        event: "game-updated",
        meta: { gameId: 7, updatedAt: 1 },
      }),
    ).toBeNull()
    expect(
      frame({
        event: "game-updated",
        meta: { gameId: GAME_ID, updatedAt: "1" },
      }),
    ).toBeNull()
  })
})

//---- opening the channel -----------------------------------------
//the socket library loads on the first signed-in connect, not with the page:
//a guest never opens a channel, so it only delayed their first render

type FakeSocket = {
  url: string
  protocols: () => Promise<string[]>
  readyState: number
  OPEN: number
  send: ReturnType<typeof vi.fn>
  close: ReturnType<typeof vi.fn>
  onopen?: () => void
  onclose?: () => void
  onerror?: () => void
  onmessage?: (message: { data: unknown }) => void
}

function fakeSocketClass() {
  const sockets: FakeSocket[] = []
  class FakeReconnectingWebSocket {
    constructor(url: string, protocols: () => Promise<string[]>) {
      const socket: FakeSocket = {
        url,
        protocols,
        readyState: 0,
        OPEN: 1,
        send: vi.fn(),
        close: vi.fn(),
      }
      sockets.push(socket)
      // biome-ignore lint/correctness/noConstructorReturn: hands the test the instance it inspects
      return socket
    }
  }
  return {
    sockets,
    load: async () => FakeReconnectingWebSocket as unknown as SocketClass,
  }
}

function handlers() {
  return { onEvent: vi.fn(), onConnectedChange: vi.fn() }
}

async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

describe("openRealtimeChannel", () => {
  it("opens one socket once the library has loaded, and passes events on", async () => {
    const { sockets, load } = fakeSocketClass()
    const listener = handlers()

    openRealtimeChannel(listener, load)
    expect(sockets).toHaveLength(0)
    await settle()

    expect(sockets).toHaveLength(1)
    const [socket] = sockets
    expect(socket?.url).toMatch(/^ws:\/\/.+\/api\/v1\/realtime$/)
    expect(await socket?.protocols()).toEqual(["ticket", "a-ticket"])

    socket?.onopen?.()
    expect(listener.onConnectedChange).toHaveBeenCalledWith(true)
    socket?.onmessage?.({
      data: JSON.stringify({ event: "games-changed" }),
    })
    expect(listener.onEvent).toHaveBeenCalledWith({
      event: "games-changed",
    })
  })

  it("opens nothing when closed before the library has loaded", async () => {
    const { sockets, load } = fakeSocketClass()

    const close = openRealtimeChannel(handlers(), load)
    close()
    await settle()

    expect(sockets).toHaveLength(0)
  })

  it("closes the socket it opened", async () => {
    const { sockets, load } = fakeSocketClass()

    const close = openRealtimeChannel(handlers(), load)
    await settle()
    close()

    expect(sockets[0]?.close).toHaveBeenCalledOnce()
  })

  it("stays disconnected, without throwing, when the library fails to load", async () => {
    const listener = handlers()

    openRealtimeChannel(listener, async () => {
      throw new Error("chunk failed to load")
    })
    await settle()

    expect(listener.onConnectedChange).toHaveBeenCalledWith(false)
  })
})
