import { newEndpoint } from "@repo/shared/http"
import type { MiddlewareHandler } from "hono"

//the commit this worker version was built from. the deploy sets it on the
//version (`--var BUILD_SHA:<sha>`, .github/scripts/deploy/app.sh), so after a
//rollback it reports the old commit too. unset in local dev
type BuildShaEnv = { BUILD_SHA?: string }

function buildSha(env: BuildShaEnv | undefined): string | null {
  return env?.BUILD_SHA || null
}

//x-build-sha on every response, errors included. c.header(), not
//c.res.headers.set(): a fetch() response has immutable headers, and c.header()
//re-wraps a finalized response first. a websocket upgrade passes through
//untouched, for the same reason as in the cors plugin: re-wrapping the 101 a
//durable object hands back risks the socket it carries
export function buildShaPlugin(): MiddlewareHandler<{
  Bindings: BuildShaEnv
}> {
  return async (c, next) => {
    await next()
    if (c.req.header("upgrade")?.toLowerCase() === "websocket") return
    const sha = buildSha(c.env)
    if (sha) c.header("x-build-sha", sha)
  }
}

//GET -> {"sha": "<sha>"}, for drift checks
export const versionRoute = newEndpoint<BuildShaEnv>().get("/", (c) =>
  c.json({ sha: buildSha(c.env) }, 200, { "Cache-Control": "no-store" }),
)
