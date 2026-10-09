import { env } from "cloudflare:workers"
import { beforeAll, describe, expect, it } from "vitest"
import worker from "@/entrypoint"
import { envRegistry } from "@/env/registry"
import { newExecutionContext } from "@/test-support/execution-context"

type HealthEnvelope = {
  status: string
  error_code?: string
  data?: { status: string }
}

//a D1 binding that is down: every statement it is asked to prepare throws, the
//way a real binding does when the database cannot be reached
const unreachableDb = {
  prepare() {
    throw new Error("D1_ERROR: network connection lost")
  },
} as unknown as D1Database

describe("health routes", () => {
  beforeAll(() => {
    envRegistry.setEnv(env as unknown as Record<string, unknown>)
  })

  //no origin, no token, no bypass header: what an outside probe sends
  async function probe(bindings: Record<string, unknown>) {
    const response = await worker.fetch(
      new Request("http://example.com/api/v1/health"),
      bindings as never,
      newExecutionContext(),
    )
    return {
      response,
      body: (await response.json()) as HealthEnvelope,
    }
  }

  it("answers ok when the worker and its database are up", async () => {
    const { response, body } = await probe(env as never)

    expect(response.status).toBe(200)
    expect(body.status).toBe("success")
    expect(body.data?.status).toBe("ok")
  })

  it("answers service_unavailable when the database is down", async () => {
    const { response, body } = await probe({ ...env, DB: unreachableDb })

    expect(response.status).toBe(503)
    expect(body.status).toBe("error")
    expect(body.error_code).toBe("service_unavailable")
  })
})
