import tryCatch from "@repo/shared/try-catch"
import { and, eq, gte } from "drizzle-orm"
import type { Db } from "@/database/client"
import type {
  GameEntry,
  GameEventKind,
  GameEventMode,
  GameEventResult,
} from "@/database/schema"
import { gameEvents } from "@/database/schema"
import { CustomError } from "@/http/errors"

//how far back the daily production check looks for a game start
const RECENT_START_WINDOW_MS = 72 * 60 * 60 * 1000

/** One game starting or finishing, and nothing about who played it. */
export type GameEvent = {
  gameRef: string
  kind: GameEventKind
  mode: GameEventMode
  botLevel: number | null
  result: GameEventResult | null
  moveCount: number | null
  //the first-game guide was showing when it started
  guided: boolean
  //start only: the kind of page the tab first landed on
  entry: GameEntry | null
  appVersion: string
}

//---- service ----------------

export class GameEventService {
  constructor(private db: Db) {}

  /**
   * Stores one event, stamped with the server's clock.
   *
   * The row gets its own id rather than the game's ref: a ref is shared by a
   * start and its finish, so it cannot be the key.
   */
  async record(event: GameEvent): Promise<void> {
    const [, writeError] = await tryCatch(() =>
      this.db.insert(gameEvents).values({
        id: crypto.randomUUID(),
        gameRef: event.gameRef,
        kind: event.kind,
        mode: event.mode,
        botLevel: event.botLevel,
        result: event.result,
        moveCount: event.moveCount,
        guided: event.guided,
        entry: event.entry,
        appVersion: event.appVersion,
        createdAt: new Date(),
      }),
    )
    if (writeError)
      throw new CustomError("internal_server_error", writeError)
  }

  /**
   * Whether any game started in the last 72 hours, in any mode.
   *
   * The daily production check alerts on a no, so a broken count cannot hide
   * behind a quiet week. One row is enough to answer, and the created_at index
   * finds it.
   */
  async hasRecentStart(): Promise<boolean> {
    const since = new Date(Date.now() - RECENT_START_WINDOW_MS)
    const [row, selectError] = await tryCatch(() =>
      this.db
        .select({ id: gameEvents.id })
        .from(gameEvents)
        .where(
          and(
            eq(gameEvents.kind, "start"),
            gte(gameEvents.createdAt, since),
          ),
        )
        .limit(1)
        .get(),
    )
    if (selectError)
      throw new CustomError("service_unavailable", selectError)
    return row !== undefined
  }
}
