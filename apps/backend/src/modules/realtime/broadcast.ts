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
 * Sends one beacon to every subscriber. A socket the runtime has already given up
 * on must not cost the rest of the channel its beacon, so each send stands on its
 * own; the failures are logged once, with the channel and the request behind it.
 */
export async function broadcast(
  sockets: WebSocket[],
  payload: RealtimeEvent,
  context: PublishContext,
): Promise<void> {
  const frame = JSON.stringify(payload)
  let failed = 0
  let lastError: Error | null = null

  for (const socket of sockets) {
    const [, sendError] = tryCatch(() => socket.send(frame))
    if (sendError) {
      failed++
      lastError = sendError
    }
  }
  if (failed === 0) return

  const fields: LogContext = context.request_id
    ? { request_id: context.request_id }
    : {}
  withLogContext(fields, () =>
    log.warn("pubsub_send_failed", {
      channel: context.channel,
      event: payload.event,
      game_id:
        payload.event === "game-updated" ? payload.meta.gameId : undefined,
      failed,
      subscribers: sockets.length,
      error: lastError,
    }),
  )
}
