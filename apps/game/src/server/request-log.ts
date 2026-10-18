import { requestIdFrom, withLogContext } from "@repo/shared/log-context"
import { Logger } from "@repo/shared/logging"

const log = new Logger("request")

//---- route pattern ----------------
//the router's patterns with an id in them; the raw path would put invite tokens and
//game ids in the log. a path of plain lowercase words is a page and logs as itself;
//anything else (hashed assets, scanners) logs as "*"

const DYNAMIC_ROUTES: [RegExp, string][] = [
  [/^\/invite\/[^/]+$/, "/invite/:linkId"],
  [/^\/online\/(?!history$)[^/]+$/, "/online/:gameId"],
  [/^\/game\/online\/[^/]+$/, "/game/online/:gameId"],
]

const PLAIN_PATH = /^(\/[a-z]+(-[a-z]+)*)*\/?$/

export function routePatternOf(pathname: string): string {
  for (const [pattern, route] of DYNAMIC_ROUTES)
    if (pattern.test(pathname)) return route
  return PLAIN_PATH.test(pathname) ? pathname : "*"
}

//---- request log ----------------

function withRequestIdHeader(
  response: Response,
  requestId: string,
): Response {
  //copy instead of mutating: a fetched or streamed response can carry immutable headers
  const headers = new Headers(response.headers)
  headers.set("x-request-id", requestId)
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

/**
 * One `request` line per request, every line written while handling it tagged with
 * its `request_id`, and the id on the response. `respond` gets the id to pass on to
 * the backend. A throw is logged with its stack and rethrown.
 */
export async function withRequestLog(
  request: Request,
  respond: (requestId: string) => Promise<Response>,
): Promise<Response> {
  const requestId = requestIdFrom(request)
  const route = routePatternOf(new URL(request.url).pathname)
  const startedAt = Date.now()

  return withLogContext({ request_id: requestId }, async () => {
    let status = 500
    try {
      const response = await respond(requestId)
      status = response.status
      return withRequestIdHeader(response, requestId)
    } catch (caught) {
      log.error("game_unhandled_exception", {
        method: request.method,
        route,
        error: caught,
      })
      throw caught
    } finally {
      const fields = {
        method: request.method,
        route,
        status,
        duration_ms: Date.now() - startedAt,
        colo: (request as { cf?: { colo?: string } }).cf?.colo,
      }
      if (status >= 500) log.error("request", fields)
      else log.info("request", fields)
    }
  })
}
