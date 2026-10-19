import { env } from "cloudflare:workers"
import { beforeAll, describe, expect, it } from "vitest"
import worker from "@/entrypoint"
import { envRegistry } from "@/env/registry"
import { newExecutionContext } from "@/test-support/execution-context"

type HealthEnvelope = {
  status: string
  error_code?: string
  data?: Record<string, string>
}

//a D1 binding that is down: every statement it is asked to prepare throws, the
//way a real binding does when the database cannot be reached
const unreachableDb = {
  prepare() {
    throw new Error("D1_ERROR: network connection lost")
  },
} as unknown as D1Database

//an R2 binding that is down, and one that never answers at all
const unreachableBucket = {
  async head() {
    throw new Error("R2 error: we encountered an internal error")
  },
} as unknown as R2Bucket

const hangingBucket = {
  head: () => new Promise(() => {}),
} as unknown as R2Bucket

describe("health routes", () => {
  beforeAll(() => {
    envRegistry.setEnv(env as unknown as Record<string, unknown>)
  })

  //no origin, no token, no bypass header: what an outside probe sends. each
  //test probes from its own address, so the health limiter's count from one
  //test never sheds the next one's probe
  async function probe(bindings: Record<string, unknown>, ip: string) {
    const response = await worker.fetch(
      new Request("http://example.com/api/v1/health", {
        headers: { "cf-connecting-ip": ip },
      }),
      bindings as never,
      newExecutionContext(),
    )
    return {
      response,
      body: (await response.json()) as HealthEnvelope,
    }
  }

  it("reports every resource ok when the worker and its resources are up", async () => {
    const { response, body } = await probe(env as never, "203.0.113.20")

    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(body).toEqual({
      status: "success",
      data: { database: "ok", r2: "ok" },
    })
  })

  it("answers 503 and names the database when it is down", async () => {
    const { response, body } = await probe(
      { ...env, DB: unreachableDb },
      "203.0.113.21",
    )

    expect(response.status).toBe(503)
    expect(body).toEqual({
      status: "error",
      error_code: "service_unavailable",
      data: { database: "down", r2: "ok" },
    })
  })

  it("answers 503 and names the bucket when it is down", async () => {
    const { response, body } = await probe(
      { ...env, AVATARS: unreachableBucket },
      "203.0.113.22",
    )

    expect(response.status).toBe(503)
    expect(body.data).toEqual({ database: "ok", r2: "down" })
  })

  it("reports a resource that does not answer in time as down", async () => {
    const { response, body } = await probe(
      { ...env, AVATARS: hangingBucket },
      "203.0.113.23",
    )

    expect(response.status).toBe(503)
    expect(body.data).toEqual({ database: "ok", r2: "down" })
  })

  it("never puts an error message in the report", async () => {
    const { body } = await probe(
      { ...env, DB: unreachableDb, AVATARS: unreachableBucket },
      "203.0.113.24",
    )

    expect(JSON.stringify(body)).not.toContain("D1_ERROR")
    expect(JSON.stringify(body)).not.toContain("R2 error")
  })

  it("sheds a caller past the health limit with 429", async () => {
    for (let index = 0; index < 60; index++) {
      const { response } = await probe(env as never, "203.0.113.25")
      expect(response.status).toBe(200)
    }

    const { response, body } = await probe(env as never, "203.0.113.25")
    expect(response.status).toBe(429)
    expect(body.error_code).toBe("rate_limit_exceeded")

    //another caller is still answered: the limit is per address
    const other = await probe(env as never, "203.0.113.26")
    expect(other.response.status).toBe(200)
  })
})
