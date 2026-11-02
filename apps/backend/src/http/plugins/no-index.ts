import type { MiddlewareHandler } from "hono"

//x-robots-tag: noindex on every response, errors included. the api answers
//json to machines and none of it belongs in a search result; robots.txt must
//not block /api instead, or a crawler that already found a link never reads
//this header. c.header() re-wraps a finalized response, as in the build-sha
//plugin; a websocket upgrade passes through untouched, for the same reason
export function noIndexPlugin(): MiddlewareHandler {
  return async (c, next) => {
    await next()
    if (c.req.header("upgrade")?.toLowerCase() === "websocket") return
    c.header("x-robots-tag", "noindex")
  }
}
