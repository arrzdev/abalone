import { WEAKEST } from "@/ai/profiles"
import type { BotRequest, BotResponse } from "@/ai/protocol"
import type { Bot } from "@/ai/search"
import { createBot } from "@/ai/search"

/**
 * The bot's thread.
 *
 * One bot is kept alive for the whole game rather than made per move, because
 * it remembers the positions the game has already stood in — take that away and
 * it will happily shuffle a pair of marbles back and forth forever.
 */
let bot: Bot | null = null

//why: the worker global is not the `self` the app's DOM lib describes, and the
//two lib sets cannot both be loaded in one program — so it is bridged once here
const thread = self as unknown as {
  onmessage: ((event: MessageEvent<BotRequest>) => void) | null
  postMessage: (message: BotResponse) => void
}

thread.onmessage = ({ data }) => {
  const { kind, ticket } = data
  try {
    switch (data.kind) {
      case "open":
        bot = createBot(data.payload.level)
        thread.postMessage({ kind: "opened", ticket })
        break

      case "think":
        bot ??= createBot(data.payload.level ?? WEAKEST)
        thread.postMessage({
          kind: "move",
          ticket,
          move: bot.chooseMove(data.payload.board),
        })
        break

      case "close":
        bot = null
        thread.postMessage({ kind: "closed", ticket })
        break

      default:
        throw new Error(`unknown request '${kind}'`)
    }
  } catch (error) {
    thread.postMessage({
      kind: "failed",
      ticket,
      reason: error instanceof Error ? error.message : String(error),
    })
  }
}
