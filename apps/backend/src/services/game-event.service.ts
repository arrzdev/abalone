import tryCatch from "@repo/shared/try-catch"
import type { Db } from "@/database/client"
import type {
  GameEventKind,
  GameEventMode,
  GameEventResult,
} from "@/database/schema"
import { gameEvents } from "@/database/schema"
import { CustomError } from "@/http/errors"

/** One game starting or finishing, and nothing about who played it. */
export type GameEvent = {
  gameRef: string
  kind: GameEventKind
  mode: GameEventMode
  botLevel: number | null
  result: GameEventResult | null
  moveCount: number | null
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
        appVersion: event.appVersion,
        createdAt: new Date(),
      }),
    )
    if (writeError)
      throw new CustomError("internal_server_error", writeError)
  }
}
