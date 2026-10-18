import { withLogContext } from "@repo/shared/log-context"
import { Logger } from "@repo/shared/logging"
import { createMiddleware } from "hono/factory"
import type { AuthedVariables } from "@/http/middlewares/auth"
import { endpointPattern } from "@/http/utils/endpoint-pattern"

export type RequestLogVariables = {
  requestId: string
}

const log = new Logger("request")

//any caller can send x-request-id and it is echoed in logs, the header and error bodies
const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]{1,128}$/

//a caller's id (the game's service binding, a retry) wins, then the edge's cf-ray,
//then a new one
function resolveRequestId(request: Request): string {
  const incoming = request.headers.get("x-request-id")
  if (incoming && SAFE_REQUEST_ID.test(incoming)) return incoming
  return request.headers.get("cf-ray") || crypto.randomUUID()
}

function setResponseHeader(
  c: { res: Response },
  name: string,
  value: string,
) {
  try {
    c.res.headers.set(name, value)
  } catch {
    //a passed-through fetch() response has immutable headers
    c.res = new Response(c.res.body, c.res)
    c.res.headers.set(name, value)
  }
}

//first in the chain: gives the request an id, puts it on every log line written while
//handling it and on the response, then writes one "request" line per request.
//the route is the matched pattern, never the raw url (no ids, query strings or tokens)
export function requestLog() {
  return createMiddleware<{
    Variables: RequestLogVariables & Partial<AuthedVariables>
  }>(async (c, next) => {
    const requestId = resolveRequestId(c.req.raw)
    const startedAt = Date.now()
    c.set("requestId", requestId)

    await withLogContext({ request_id: requestId }, async () => {
      await next()

      setResponseHeader(c, "x-request-id", requestId)
      const status = c.res.status
      const fields = {
        method: c.req.method,
        route: endpointPattern(c),
        status,
        duration_ms: Date.now() - startedAt,
        user_id: c.get("user")?.id,
        colo: c.req.raw.cf?.colo,
      }
      if (status >= 500) log.error("request", fields)
      else log.info("request", fields)
    })
  })
}
