import type { CellName, SearchBoard } from "@/engine/types"

/**
 * What crosses the wire between the board and the bot.
 *
 * The bot may be a worker on its own thread or the same search running inline
 * (see `bot-client.ts`), so both sides of the conversation are written down
 * here rather than in either of them.
 */

/** A bot's answer: the line it picked up, and the square it moved onto. */
export type BotMove = {
  type: "move"
  selection: CellName[] | null
  move: CellName | null
  score: number
}

export type BotRequest =
  | { kind: "open"; ticket: number; payload: { level: number } }
  | {
      kind: "think"
      ticket: number
      payload: { board: SearchBoard; level?: number }
    }
  | { kind: "close"; ticket: number; payload?: undefined }

export type BotResponse =
  | { kind: "opened"; ticket: number }
  | { kind: "move"; ticket: number; move: BotMove }
  | { kind: "closed"; ticket: number }
  | { kind: "failed"; ticket: number; reason: string }
