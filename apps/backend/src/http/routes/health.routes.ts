import { newEndpoint } from "@repo/shared/http"
import { getDb } from "@/database/client"
import type { Env } from "@/env/registry"
import { ok } from "@/http/envelope"
import { HealthService } from "@/services/health.service"

//the probe production can reach: only /api/* is routed to this worker, so the
//root health in api.ts answers locally but never from outside. unlike that one,
//this asks D1 too. no rate limit and no auth, for the same reason as the root:
//shedding or refusing the probe is how a healthy worker gets reported as down.
export const healthRoutes = newEndpoint<Env>()
  //---- check ----------------

  .get("/", async (c) => {
    const healthService = new HealthService(getDb(c.env.DB))
    await healthService.checkDatabase()
    return ok(c, { status: "ok" })
  })
