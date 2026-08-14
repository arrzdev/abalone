import { newEndpoint } from "@repo/shared/http"
import type { Env } from "@/env/registry"
import { error, ok } from "@/http/envelope"
import { errorCatcher } from "@/http/middlewares/error-catcher"
import { corsPlugin } from "@/http/plugins/cors"
import { v1Routes } from "@/http/routes"

//composed transport api: cors, global error catcher, health, v1 routes,
//not-found. the worker entrypoint just bootstraps env and delegates to
//api.fetch.
export const api = newEndpoint<Env>()
  .use("*", corsPlugin()) //setup cors plugin
  .onError(errorCatcher) //catch + envelope unhandled throws

  //health lives at the root and outside the version prefix on purpose: an
  //uptime check asks "is this worker answering", which is not a question the
  //api contract can version. it takes no rate limit either — shedding the
  //probe is how a healthy worker gets reported as down.
  .get("/", (c) => ok(c, { status: "ok" }))

  .route("/api/v1", v1Routes) //define v1 routes
  .all("*", (c) => error(c, "endpoint_not_found")) //handle route not found
