import { cors } from "hono/cors"
import {
  allowsPrivateOrigins,
  frontendOrigins,
} from "@/http/network-policy"
import { isPrivateOrigin } from "@/utils/is-private-origin"

const PREFLIGHT_MAX_AGE_SECONDS = 86_400 // 24h — browser skips OPTIONS until cache expires

//explicit allowlist now that the api is credentialed (bearer tokens + the
//better-auth session-cookie cache). reflects any configured frontend origin,
//plus localhost/LAN origins in dev so a phone on the network can sign in. the
//client reads its session token from the exposed `set-auth-token` header.
export function corsPlugin() {
  return cors({
    origin: (origin) => {
      //with nothing configured there is no allowlist, so nothing is reflected
      const allowed = frontendOrigins()
      //a request with no Origin header is not a browser asking permission. it
      //gets the first configured origin, which is only ever echoed into a
      //header nobody in that case reads.
      if (!origin) return allowed[0] ?? null
      if (allowed.includes(origin)) return origin
      if (allowsPrivateOrigins() && isPrivateOrigin(origin)) return origin
      return null
    },
    credentials: true,
    allowMethods: ["GET", "HEAD", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    exposeHeaders: ["set-auth-token"],
    maxAge: PREFLIGHT_MAX_AGE_SECONDS,
  })
}
