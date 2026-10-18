import type { Context } from "hono"
import { matchedRoutes, routePath } from "hono/route"

//the pattern of the endpoint the request matched, even when a middleware answered or
//threw before it ran. routePath(c) alone gives the last handler that ran ("/v1/*").
//use() middleware and the .all("*") fallback register as ALL; endpoints never do
export function endpointPattern(c: Context): string {
  const routes = matchedRoutes(c)
  for (let i = routes.length - 1; i >= 0; i--) {
    const route = routes[i]
    if (route && route.method !== "ALL") return route.path
  }
  return routePath(c)
}
