import { newEndpoint } from "@repo/shared/http"
import type { Env } from "@/env/registry"
import { error, ok } from "@/http/envelope"
import { errorCatcher } from "@/http/middlewares/error-catcher"
import { requestLog } from "@/http/middlewares/request-log"
import { buildShaPlugin, versionRoute } from "@/http/plugins/build-sha"
import { corsPlugin } from "@/http/plugins/cors"
import { v1Routes } from "@/http/routes"

//composed transport api: build sha, cors, global error catcher, liveness,
//version, v1 routes, not-found. the worker entrypoint just bootstraps env and
//delegates to api.fetch.
export const api = newEndpoint<Env>()
  .use("*", requestLog()) //first: request id + one request log line
  .use("*", buildShaPlugin()) //x-build-sha on every response
  .use("*", corsPlugin()) //setup cors plugin
  .onError(errorCatcher) //catch + envelope unhandled throws

  //liveness lives at the root and outside the version prefix on purpose: an
  //uptime check asks "is this worker answering", which is not a question the
  //api contract can version. it takes no rate limit either — shedding the
  //probe is how a healthy worker gets reported as down. production routes
  //only /api/* here, so the probe reachable from outside is /api/v1/health.
  .get("/", (c) => ok(c, { status: "ok" }))

  //the deployed commit, for drift checks. under /api because production only
  //routes /api/* to this worker, and outside /v1 for the same reason as health
  .route("/api/version", versionRoute)

  .route("/api/v1", v1Routes) //define v1 routes
  .all("*", (c) => error(c, "endpoint_not_found")) //handle route not found
