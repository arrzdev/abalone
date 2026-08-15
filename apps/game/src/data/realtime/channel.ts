import type { RealtimeEvent } from "@repo/backend/realtime/events"
import tryCatch from "@repo/shared/try-catch"
import ReconnectingWebSocket from "partysocket/ws"
import { backendBaseUrl } from "@/data/backend-client"
import { mintTicket } from "@/data/realtime/ticket"

/** How often the socket says hello, so an idle connection is not reaped. */
const PING_INTERVAL_MS = 30_000

//`ws:` for `http:`, `wss:` for `https:`. derived from the api's own origin
//rather than configured a second time, so the dev hostname rewrite in
//backend-client applies here too and a phone on the LAN needs no extra setup.
const realtimeUrl = `${backendBaseUrl.replace(/^http/, "ws")}/api/v1/realtime`

export type RealtimeHandlers = {
  /** One beacon, already parsed and known to be an event we understand. */
  onEvent: (event: RealtimeEvent) => void
  /** Whether a socket is currently open, so callers can fall back to polling. */
  onConnectedChange: (isConnected: boolean) => void
}

/**
 * The frame the server sent, or null if it is not one we know.
 *
 * The channel is server-written, but a frame is still input. Anything that does
 * not match a known event is dropped rather than guessed at, which also quietly
 * handles the `pong` the runtime answers our keepalive with.
 */
function parseEvent(data: unknown): RealtimeEvent | null {
  if (typeof data !== "string") return null

  const [parsed, parseError] = tryCatch(
    () =>
      JSON.parse(data) as {
        event?: unknown
        meta?: { gameId?: unknown; moveCount?: unknown }
      },
  )
  if (parseError) return null

  if (parsed?.event === "invites-changed") return { event: parsed.event }
  if (parsed?.event === "games-changed") return { event: parsed.event }
  if (parsed?.event !== "game-updated") return null

  const gameId = parsed.meta?.gameId
  const moveCount = parsed.meta?.moveCount
  if (typeof gameId !== "string" || typeof moveCount !== "number")
    return null

  return { event: "game-updated", meta: { gameId, moveCount } }
}

/**
 * Opens this device's realtime channel and keeps it open.
 *
 * @returns a function that closes it, for the caller's cleanup.
 */
export function openRealtimeChannel(
  handlers: RealtimeHandlers,
): () => void {
  const socket = new ReconnectingWebSocket(
    //an async url provider, so every connect AND every reconnect mints its own
    //ticket. a thirty-second ticket cannot survive a reconnect, and this is
    //what means nothing else has to remember that.
    async () =>
      `${realtimeUrl}?ticket=${encodeURIComponent(await mintTicket())}`,
    undefined,
    //nothing this socket sends is worth replaying: a keepalive that missed its
    //window is not one the next connection needs to deliver late
    { maxEnqueuedMessages: 0 },
  )

  //"ping" is the string the durable object auto-answers, so this holds the
  //connection open through a carrier proxy without ever waking the object —
  //which is the whole reason an idle subscriber is affordable
  const keepalive = setInterval(() => {
    if (socket.readyState === socket.OPEN) socket.send("ping")
  }, PING_INTERVAL_MS)

  socket.onopen = () => handlers.onConnectedChange(true)
  socket.onclose = () => handlers.onConnectedChange(false)
  socket.onerror = () => handlers.onConnectedChange(false)
  socket.onmessage = (message) => {
    const event = parseEvent(message.data)
    if (event) handlers.onEvent(event)
  }

  return () => {
    clearInterval(keepalive)
    socket.close()
  }
}
