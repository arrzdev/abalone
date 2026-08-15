import type { SearchBoard } from "@repo/abalone-engine/types"
import { WEAKEST } from "@/ai/profiles"
import type { BotMove, BotRequest, BotResponse } from "@/ai/protocol"
import type { Bot } from "@/ai/search"
import { createBot } from "@/ai/search"

type Pending = {
  resolve: (move: BotMove | undefined) => void
  reject: (error: Error) => void
}

/**
 * A bot, thinking somewhere else.
 *
 * The search is a tight synchronous loop, and at the deeper levels it runs long
 * enough to be felt: on the main thread it would stall React mid-render and the
 * board would freeze with a marble half-way to its square. So it is handed to a
 * worker and awaited, which costs a message round trip and buys a page that
 * keeps painting while the bot thinks.
 *
 * Where Workers are unavailable the same search runs inline. It is slower to
 * live with, never wrong.
 */
export class BotClient {
  #worker: Worker | null = null
  #inline: Bot | null = null
  #level = WEAKEST
  #nextTicket = 1
  #waiting = new Map<number, Pending>()

  /** Starts a fresh bot for a new game. */
  async connect(level: number): Promise<void> {
    this.#level = level
    this.#inline = null

    const sent = this.#send("open", { level })
    if (sent) await sent
    else this.#inline = createBot(level)
  }

  /** @param board from `toSearchState` */
  async requestMove(board: SearchBoard): Promise<BotMove> {
    const sent = this.#send("think", { board, level: this.#level })
    if (sent) {
      try {
        const move = await sent
        if (move) return move
      } catch {
        // The worker died mid-search. Answer inline rather than skip a turn —
        // but note that its memory of the game went with it.
      }
    }
    this.#inline ??= createBot(this.#level)
    return this.#inline.chooseMove(board)
  }

  disconnect(): void {
    this.#worker?.terminate()
    this.#worker = null
    for (const { reject } of this.#waiting.values()) {
      reject(new Error("bot disconnected"))
    }
    this.#waiting.clear()
    this.#inline = null
  }

  /** Null when there is no worker to send to. */
  #send<K extends BotRequest["kind"]>(
    kind: K,
    payload: Extract<BotRequest, { kind: K }>["payload"],
  ): Promise<BotMove | undefined> | null {
    const worker = this.#connectWorker()
    if (!worker) return null

    const ticket = this.#nextTicket++
    return new Promise((resolve, reject) => {
      this.#waiting.set(ticket, { resolve, reject })
      worker.postMessage({ kind, ticket, payload })
    })
  }

  #connectWorker(): Worker | null {
    if (this.#worker || typeof Worker === "undefined") return this.#worker

    try {
      this.#worker = new Worker(
        new URL("./bot.worker.ts", import.meta.url),
        { type: "module" },
      )
      this.#worker.onmessage = ({ data }: MessageEvent<BotResponse>) => {
        const pending = this.#waiting.get(data.ticket)
        if (!pending) return
        this.#waiting.delete(data.ticket)
        if (data.kind === "failed") pending.reject(new Error(data.reason))
        else pending.resolve(data.kind === "move" ? data.move : undefined)
      }
      this.#worker.onerror = (event) => {
        // Fail everything in flight; each caller falls back to the inline search.
        for (const { reject } of this.#waiting.values()) {
          reject(new Error(event.message || "bot worker error"))
        }
        this.#waiting.clear()
        this.#worker = null
      }
    } catch {
      this.#worker = null
    }
    return this.#worker
  }
}
