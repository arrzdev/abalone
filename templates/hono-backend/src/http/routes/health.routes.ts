import { newEndpoint } from "@repo/shared/http"
import { getDb } from "@/database/client"
import type { Env } from "@/env/registry"
import { ERROR_CODES } from "@/http/errors"
import { rateLimit } from "@/http/middlewares/rate-limit"
import { HealthService } from "@/services/health.service"

const NO_STORE = { "Cache-Control": "no-store" }

//the probe production can reach: only /api/* is routed to this worker, so the
//root liveness in api.ts answers locally but never from outside. unlike that
//one, this asks every resource the worker uses and names each one in the body.
//
//no auth, but its own per-address limit: an unauthenticated route that fans
//out to D1 on every hit is a cheap way to make us pay for traffic. the
//ceiling is far above any monitor's cadence, so a real probe is never shed.
export const healthRoutes = newEndpoint<Env>()
  //---- check ----------------

  .get("/", rateLimit("health"), async (c) => {
    const healthService = new HealthService(getDb(c.env.DB))
    const report = await healthService.check()

    //the one route that answers a failure itself rather than throwing it: a
    //503 that does not say which resource is down is the part a probe needs
    if (Object.values(report).every((state) => state === "ok"))
      return c.json({ status: "success", data: report }, 200, NO_STORE)

    const errorCode = "service_unavailable"
    return c.json(
      { status: "error", error_code: errorCode, data: report },
      ERROR_CODES[errorCode][1],
      NO_STORE,
    )
  })
