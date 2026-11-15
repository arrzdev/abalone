import {
  createGameState,
  toSearchState,
} from "@repo/abalone-engine/game-state"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { BotRequest, BotResponse } from "@/ai/protocol"

//the worker's whole job is `onmessage`, so the module is imported against a
//`self` whose `postMessage` is a spy, and requests are delivered by hand

const BOARD = toSearchState(createGameState("standard", "black", "ai"))

type Thread = {
  onmessage: ((event: MessageEvent<BotRequest>) => void) | null
  postMessage: (message: BotResponse) => void
}

let replies: BotResponse[]

async function boot(): Promise<(request: unknown) => void> {
  vi.resetModules()
  replies = []
  const thread = self as unknown as Thread
  thread.postMessage = (message) => {
    replies.push(message)
  }
  await import("@/ai/bot.worker")
  return (request) =>
    thread.onmessage?.({ data: request } as MessageEvent<BotRequest>)
}

describe("bot worker", () => {
  beforeEach(() => {
    replies = []
  })

  afterEach(() => {
    ;(self as unknown as Thread).onmessage = null
  })

  it("opens a bot and says so, under the ticket it was asked with", async () => {
    const send = await boot()

    send({ kind: "open", ticket: 4, payload: { level: 3 } })

    expect(replies).toEqual([{ kind: "opened", ticket: 4 }])
  })

  it("answers a think with a move", async () => {
    const send = await boot()
    send({ kind: "open", ticket: 1, payload: { level: 3 } })

    send({ kind: "think", ticket: 2, payload: { board: BOARD } })

    const reply = replies[1]
    expect(reply).toMatchObject({ kind: "move", ticket: 2 })
    if (reply.kind !== "move") throw new Error("not a move")
    expect(reply.move.selection?.length).toBeGreaterThan(0)
  })

  it("makes a bot of its own when asked to think before it was opened", async () => {
    const send = await boot()

    send({ kind: "think", ticket: 1, payload: { board: BOARD, level: 2 } })

    expect(replies[0]).toMatchObject({ kind: "move", ticket: 1 })
  })

  it("closes the bot", async () => {
    const send = await boot()
    send({ kind: "open", ticket: 1, payload: { level: 3 } })

    send({ kind: "close", ticket: 2 })

    expect(replies[1]).toEqual({ kind: "closed", ticket: 2 })
  })

  it("reports a request it does not know, rather than going silent", async () => {
    const send = await boot()

    send({ kind: "dance", ticket: 9 })

    expect(replies).toEqual([
      { kind: "failed", ticket: 9, reason: "unknown request 'dance'" },
    ])
  })

  it("reports a search that throws", async () => {
    const send = await boot()
    send({ kind: "open", ticket: 1, payload: { level: 3 } })

    //no board at all: reading it throws inside the search
    send({ kind: "think", ticket: 2, payload: { board: null } })

    expect(replies[1]).toMatchObject({ kind: "failed", ticket: 2 })
  })
})
