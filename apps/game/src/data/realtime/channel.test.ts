import { describe, expect, it } from "vitest"
import { parseEvent } from "@/data/realtime/channel"

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
