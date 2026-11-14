import { env } from "cloudflare:workers"
import { beforeAll, describe, expect, it } from "vitest"
import worker from "@/entrypoint"
import { envRegistry } from "@/env/registry"
import { newExecutionContext } from "@/test-support/execution-context"

//the routes api.ts answers itself, outside any domain: the uptime probe, the
//deployed commit and the not-found fallback. each plugin has its own test with
//a bare app; these go through the whole worker, as deployed.

type Envelope = {
  status: string
  error_code?: string
  data?: unknown
}

function fetchWorker(
  path: string,
  init: RequestInit = {},
  bindings: Record<string, unknown> = {},
) {
  return worker.fetch(
    new Request(`http://example.com${path}`, init),
    { ...env, ...bindings } as never,
    newExecutionContext(),
  )
}

describe("api", () => {
  beforeAll(() => {
    envRegistry.setEnv(env as unknown as Record<string, unknown>)
  })

  //---- uptime probe ----------------

  it("answers the uptime probe with ok and no session", async () => {
    const response = await fetchWorker("/")

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      status: "success",
      data: { status: "ok" },
    })
  })

  //---- deployed commit ----------------

  it("names the deployed commit without a session", async () => {
    const response = await fetchWorker(
      "/api/version",
      {},
      {
        BUILD_SHA: "abc1234",
      },
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(await response.json()).toEqual({ sha: "abc1234" })
  })

  //---- not found ----------------
  //only outside a signed-in prefix: under /games or /profile the session guard
  //answers first, so a guest learns nothing about which paths exist there

  it.each([
    ["GET", "/nope"],
    ["GET", "/api/v1/nope"],
    ["GET", "/api/v2/health"],
    ["POST", "/api/v1/health"],
  ])("answers %s %s with endpoint_not_found", async (method, path) => {
    const response = await fetchWorker(path, {
      method,
      headers: { "x-test-bypass": "true" },
    })

    expect(response.status).toBe(404)
    const body = (await response.json()) as Envelope
    expect(body.status).toBe("error")
    expect(body.error_code).toBe("endpoint_not_found")
  })
})
