import type { MiddlewareHandler } from "hono"
import { cors } from "hono/cors"
import {
  frontendOrigins,
  isAllowedFrontendOrigin,
} from "@/http/network-policy"

const PREFLIGHT_MAX_AGE_SECONDS = 86_400 // 24h — browser skips OPTIONS until cache expires

//explicit allowlist, credentialed so an auth layer can be added without
//touching CORS. reflects any configured frontend origin, plus localhost/LAN
//origins in dev so a phone on the network can reach the api. a project that
//adds bearer auth exposes its token header here too (abalone: set-auth-token).
export function corsPlugin(): MiddlewareHandler {
  const applyCors = cors({
    origin: (origin) => {
      //a request with no Origin header is not a browser asking permission. it
      //gets the first configured origin, which is only ever echoed into a
      //header nobody in that case reads. with nothing configured there is no
      //allowlist, so nothing is reflected.
      if (!origin) return frontendOrigins()[0] ?? null
      return isAllowedFrontendOrigin(origin) ? origin : null
    },
    credentials: true,
    allowMethods: ["GET", "HEAD", "POST", "PATCH", "DELETE", "OPTIONS"],
    //x-test-bypass is sent by an e2e suite, whose browsers share one IP. the
    //header does nothing unless RATE_LIMIT_ALLOW_TEST_BYPASS is set, which only
    //the e2e and vitest Workers do (see middlewares/rate-limit.ts).
    allowHeaders: ["Content-Type", "Authorization", "x-test-bypass"],
    exposeHeaders: ["x-request-id"],
    maxAge: PREFLIGHT_MAX_AGE_SECONDS,
  })

  return async (c, next) => {
    //a websocket upgrade must pass through untouched. hono/cors writes its
    //headers onto the response after the handler runs, and the 101 a durable
    //object hands back has immutable headers and carries the socket itself on a
    //non-standard property — so writing to it either throws or quietly returns
    //a response with no socket on it. CORS does not govern a handshake anyway;
    //the origin check for one belongs in the route that upgrades
    //(isAllowedFrontendOrigin in network-policy.ts).
    if (c.req.header("upgrade")?.toLowerCase() === "websocket")
      return next()

    return applyCors(c, next)
  }
}
