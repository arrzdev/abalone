import {
  createGameState,
  toSearchState,
} from "@repo/abalone-engine/game-state"
import { afterEach, describe, expect, it, vi } from "vitest"
import { BotClient } from "@/ai/bot-client"
import type { BotMove, BotRequest, BotResponse } from "@/ai/protocol"

//the bot's thread is stood in by a worker that records what it was sent and
//answers (or not) as each test arranges. the inline fallback is the real
//search, which is what a player gets where Workers are missing.

const BOARD = toSearchState(createGameState("standard", "black", "ai"))

const WORKER_MOVE: BotMove = {
  type: "move",
  selection: ["-4,0"],
  move: "-3,0",
  score: 7,
}

type Answer = (request: BotRequest) => BotResponse | "silent" | "crash"

class FakeWorker {
  static instances: FakeWorker[] = []
  static answer: Answer = (request) => ({
    kind: "opened",
    ticket: request.ticket,
  })

  onmessage: ((event: MessageEvent<BotResponse>) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  sent: BotRequest[] = []
  terminated = false

  constructor() {
    FakeWorker.instances.push(this)
  }

  postMessage(request: BotRequest) {
    this.sent.push(request)
    const answer = FakeWorker.answer(request)
    if (answer === "silent") return
    queueMicrotask(() => {
      if (answer === "crash") {
        this.onerror?.({ message: "boom" } as ErrorEvent)
        return
      }
      this.onmessage?.({ data: answer } as MessageEvent<BotResponse>)
    })
  }

  terminate() {
    this.terminated = true
  }
}

function useWorker(answer: Answer) {
  FakeWorker.instances = []
  FakeWorker.answer = answer
  vi.stubGlobal("Worker", FakeWorker)
}

function isMove(move: BotMove) {
  expect(move.type).toBe("move")
  expect(move.selection?.length).toBeGreaterThan(0)
  expect(move.move).toEqual(expect.any(String))
}

describe("BotClient without Workers", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("plays the same search inline", async () => {
    vi.stubGlobal("Worker", undefined)
    const client = new BotClient()

    await client.connect(3)

    isMove(await client.requestMove(BOARD))
  })

  it("can be asked for a move without connecting first", async () => {
    vi.stubGlobal("Worker", undefined)

    isMove(await new BotClient().requestMove(BOARD))
  })
})

describe("BotClient with a worker", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("opens the bot at the level and waits for it to say so", async () => {
    useWorker((request) => ({ kind: "opened", ticket: request.ticket }))
    const client = new BotClient()

    await client.connect(5)

    const [worker] = FakeWorker.instances
    expect(worker.sent).toEqual([
      { kind: "open", ticket: 1, payload: { level: 5 } },
    ])
  })

  it("returns the move the worker found, with the level it was opened at", async () => {
    useWorker((request) =>
      request.kind === "think"
        ? { kind: "move", ticket: request.ticket, move: WORKER_MOVE }
        : { kind: "opened", ticket: request.ticket },
    )
    const client = new BotClient()
    await client.connect(6)

    expect(await client.requestMove(BOARD)).toEqual(WORKER_MOVE)

    expect(FakeWorker.instances[0].sent[1]).toEqual({
      kind: "think",
      ticket: 2,
      payload: { board: BOARD, level: 6 },
    })
  })

  it("keeps one worker for the whole game", async () => {
    useWorker((request) => ({
      kind: "move",
      ticket: request.ticket,
      move: WORKER_MOVE,
    }))
    const client = new BotClient()
    await client.connect(2)
    await client.requestMove(BOARD)
    await client.requestMove(BOARD)

    expect(FakeWorker.instances).toHaveLength(1)
  })

  it("answers inline when the worker reports a failure", async () => {
    useWorker((request) =>
      request.kind === "think"
        ? {
            kind: "failed",
            ticket: request.ticket,
            reason: "search blew up",
          }
        : { kind: "opened", ticket: request.ticket },
    )
    const client = new BotClient()
    await client.connect(3)

    isMove(await client.requestMove(BOARD))
  })

  it("answers inline when the worker dies mid-search, rather than skip a turn", async () => {
    useWorker((request) =>
      request.kind === "think"
        ? "crash"
        : { kind: "opened", ticket: request.ticket },
    )
    const client = new BotClient()
    await client.connect(3)

    isMove(await client.requestMove(BOARD))
  })

  it("starts a new worker after the old one crashed", async () => {
    useWorker((request) =>
      request.kind === "think"
        ? "crash"
        : { kind: "opened", ticket: request.ticket },
    )
    const client = new BotClient()
    await client.connect(3)
    await client.requestMove(BOARD)

    await client.connect(3)

    expect(FakeWorker.instances).toHaveLength(2)
  })

  it("ignores an answer for a ticket nobody is waiting on", async () => {
    useWorker((request) => ({ kind: "opened", ticket: request.ticket }))
    const client = new BotClient()
    await client.connect(3)
    const [worker] = FakeWorker.instances

    expect(() =>
      worker.onmessage?.({
        data: { kind: "closed", ticket: 999 },
      } as MessageEvent<BotResponse>),
    ).not.toThrow()
  })

  it("terminates the worker on disconnect and rejects what is in flight", async () => {
    useWorker(() => "silent")
    const client = new BotClient()
    const connecting = client.connect(3)
    const outcome = connecting.then(
      () => "resolved",
      (error: Error) => error.message,
    )

    client.disconnect()

    expect(await outcome).toBe("bot disconnected")
    expect(FakeWorker.instances[0].terminated).toBe(true)
  })

  it("falls back to the inline search when a worker cannot be built", async () => {
    vi.stubGlobal(
      "Worker",
      class {
        constructor() {
          throw new Error("blocked by CSP")
        }
      },
    )
    const client = new BotClient()

    await client.connect(3)

    isMove(await client.requestMove(BOARD))
  })
})
