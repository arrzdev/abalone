import { withLogContext } from "@repo/shared/log-context"
import type { LogContext } from "@repo/shared/logging"
import { Logger } from "@repo/shared/logging"
import tryCatch from "@repo/shared/try-catch"
import type { RealtimeEvent } from "@/modules/realtime/events"

const log = new Logger("pubsub")

//what the worker tells the object about the publish, for its log lines: the object
//cannot read its own name, and the request that caused the publish ran in the worker
export type PublishContext = {
  channel: string
  request_id?: string
}

/**
 * Sends one beacon to every subscriber, then writes one `pubsub.publish` line for
 * the publish. A socket the runtime has already given up on must not cost the rest
 * of the channel its beacon, so each send stands on its own; the failures go on
 * that one line, with the channel and the request behind it.
 */
export async function broadcast(
  sockets: WebSocket[],
  payload: RealtimeEvent,
  context: PublishContext,
): Promise<void> {
  const startedAt = Date.now()
  const frame = JSON.stringify(payload)
  let failed = 0
  let lastError: Error | undefined

  for (const socket of sockets) {
    const [, sendError] = tryCatch(() => socket.send(frame))
    if (sendError) {
      failed++
      lastError = sendError
    }
  }

  const fields = {
    outcome: failed === 0 ? "ok" : "partial",
    channel: context.channel,
    event: payload.event,
    game_id:
      payload.event === "game-updated" ? payload.meta.gameId : undefined,
    subscribers: sockets.length,
    failed,
    duration_ms: Date.now() - startedAt,
    error: lastError,
  }
  const lineContext: LogContext = context.request_id
    ? { request_id: context.request_id }
    : {}
  withLogContext(lineContext, () => {
    if (failed === 0) log.info("pubsub.publish", fields)
    else log.warn("pubsub.publish", fields)
  })
}
