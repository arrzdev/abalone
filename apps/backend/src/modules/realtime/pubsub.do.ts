import { DurableObject } from "cloudflare:workers"
import { Logger } from "@repo/shared/logging"
import tryCatch from "@repo/shared/try-catch"
import type { RealtimeEvent } from "@/modules/realtime/events"

const log = new Logger("pubsub")

/**
 * One channel's subscribers, and the only thing that ever writes to them.
 *
 * Pub/sub rather than a room: clients never talk to each other, and never talk
 * back. Only the worker publishes, which is what lets the subscribe half stay
 * this small — there is no message to authorize, because there are no messages.
 *
 * A WebSocket rather than SSE for one reason: the hibernation api. A subscriber
 * that is connected but idle costs nothing, because the object is asleep and
 * the runtime is answering its keepalives. That is what makes it affordable to
 * hold a socket open for every signed-in player rather than have every one of
 * them poll on a timer.
 */
export class PubSub extends DurableObject {
  constructor(ctx: DurableObjectState, env: Cloudflare.Env) {
    super(ctx, env)

    //answered by the runtime without waking this object. an app-level keepalive
    //is what holds a connection open through a carrier proxy, and this is how
    //it stays free.
    this.ctx.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair("ping", "pong"),
    )
  }

  //---- subscribe ----------------

  /**
   * Attaches one subscriber.
   *
   * Reached through `stub.fetch()` and not through rpc, because an rpc return
   * value is serialized and serializing a Response drops the `webSocket` the
   * 101 exists to carry.
   *
   * There is nothing to check here. Whoever reaches this has already been
   * authorized by the route, and the channel is decided by which object the
   * route asked for — this end never sees a name it could get wrong.
   */
  override async fetch(): Promise<Response> {
    const [client, server] = Object.values(new WebSocketPair())

    //acceptWebSocket, not server.accept(): this is the line that lets the
    //object hibernate while the connection stays open
    this.ctx.acceptWebSocket(server)

    return new Response(null, { status: 101, webSocket: client })
  }

  //---- publish ----------------

  /** Sends one beacon to everyone listening on this channel. */
  async publish(payload: RealtimeEvent): Promise<void> {
    const frame = JSON.stringify(payload)

    for (const socket of this.ctx.getWebSockets()) {
      //a socket the runtime has already given up on must not cost the rest of
      //the channel its beacon, so each send stands on its own
      tryCatch(() => socket.send(frame))
    }
  }

  //---- socket lifecycle ----------------

  //server to client only. a subscriber has the whole authenticated api for
  //anything it wants to say, so a frame arriving here is either the keepalive
  //the runtime already answered or something with no meaning to give.
  override async webSocketMessage(): Promise<void> {}

  override async webSocketClose(
    ws: WebSocket,
    code: number,
    reason: string,
  ): Promise<void> {
    //1005 and 1006 mean "no code was sent" and "closed abnormally" — neither is
    //a code a close frame may carry, so answer a normal close instead
    const closeCode = code === 1005 || code === 1006 ? 1000 : code

    //completing the closing handshake is ours to do until the compatibility
    //date reaches 2026-04-07, when `web_socket_auto_reply_to_close` takes over
    tryCatch(() => ws.close(closeCode, reason))
  }

  override async webSocketError(
    _ws: WebSocket,
    error: unknown,
  ): Promise<void> {
    log.error(
      "pubsub_socket_error",
      error instanceof Error ? error : undefined,
      { subscribers: this.ctx.getWebSockets().length },
    )
  }
}
