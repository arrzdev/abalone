import {
  logEventFields,
  requestIdFrom,
  withLogEvent,
} from "@repo/shared/log-context"
import { Logger } from "@repo/shared/logging"
import { createMiddleware } from "hono/factory"
import type { AuthedVariables } from "@/http/middlewares/auth"
import { errorCatcher } from "@/http/middlewares/error-catcher"
import { endpointPattern } from "@/http/utils/endpoint-pattern"

export type RequestLogVariables = {
  requestId: string
}

const log = new Logger("request")

//first in the chain: gives the request an id, puts it on every log line written while
//handling it and on the response, then writes one "request" line per request: the
//wide event, carrying what services, facades and the error catcher added with
//addLogFields/addTiming. the route is the matched pattern, never the raw url (no
//ids, query strings or tokens)
export function requestLog() {
  return createMiddleware<{
    Variables: RequestLogVariables & Partial<AuthedVariables>
  }>(async (c, next) => {
    const requestId = requestIdFrom(c.req.raw)
    const startedAt = Date.now()
    c.set("requestId", requestId)

    await withLogEvent({ request_id: requestId }, async () => {
      try {
        await next()
      } catch (caught) {
        //Hono hands only Error instances to onError: anything else thrown would
        //escape the app with no response and no line, so it is caught here
        if (caught instanceof Error) throw caught
        c.res = errorCatcher(caught, c)
      } finally {
        //c.header() re-wraps a finalized response, as in the build-sha plugin. a
        //websocket upgrade is left untouched: the durable object's 101 carries the
        //socket itself, and a copy of it drops the socket (see the cors plugin)
        if (c.req.header("upgrade")?.toLowerCase() !== "websocket")
          c.header("x-request-id", requestId)
        const status = c.res.status
        //measured fields last: an added field never overwrites them, and
        //request_id comes from the log context
        const fields = {
          ...logEventFields(),
          method: c.req.method,
          route: endpointPattern(c),
          status,
          duration_ms: Date.now() - startedAt,
          user_id: c.get("user")?.id,
          colo: c.req.raw.cf?.colo,
        }
        if (status >= 500) log.error("request", fields)
        else log.info("request", fields)
      }
    })
  })
}
