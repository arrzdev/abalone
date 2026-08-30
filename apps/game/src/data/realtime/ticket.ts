import { api, apiError, withClientRequest } from "@/data/backend-client"

/**
 * Buys one realtime connection.
 *
 * A browser cannot put an `Authorization` header on a WebSocket, so the socket
 * cannot prove who it is. This can: it is an ordinary rpc call, it carries the
 * bearer token the client attaches to everything, and it hands back something
 * short-lived the socket is allowed to redeem.
 *
 * Which channel the ticket opens is decided by the server from the session, and
 * travels inside the signed ticket. Nothing on this side names a channel, and
 * nothing on this side could.
 */
export async function mintTicket(): Promise<string> {
  const response = await withClientRequest(() =>
    api.api.v1.realtime.ticket.$post(),
  )
  const body = await response.json()
  if (body.status !== "success") throw apiError(body.error_code)
  return body.data.ticket
}
