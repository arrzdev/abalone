import { env } from "cloudflare:workers"
import { beforeAll, describe, expect, it } from "vitest"
import worker from "@/entrypoint"
import { envRegistry } from "@/env/registry"

//the example test, and the shape a route test takes here: drive the real worker
//end to end and assert the envelope, not the service's internals. one happy
//path, one validation reject, one domain throw — the failure paths are the
//reason the test exists.
describe("hello routes", () => {
  beforeAll(() => {
    envRegistry.setEnv(env as unknown as Record<string, unknown>)
  })

  async function get(path: string) {
    const response = await worker.fetch(
      new Request(`http://example.com${path}`),
      env as never,
      {} as ExecutionContext,
    )
    return { response, body: await response.json() }
  }

  it("greets the default name", async () => {
    const { response, body } = await get("/api/v1/hello")

    expect(response.status).toBe(200)
    expect(body).toEqual({
      status: "success",
      data: { message: "Hello, world!" },
    })
  })

  it("greets a supplied name", async () => {
    const { body } = await get("/api/v1/hello?name=Ana")

    expect(body).toEqual({
      status: "success",
      data: { message: "Hello, Ana!" },
    })
  })

  it("rejects input the schema refuses", async () => {
    const { response, body } = await get("/api/v1/hello?name=")

    expect(response.status).toBe(400)
    expect(body).toEqual({ status: "error", error_code: "invalid_input" })
  })

  it("surfaces a domain throw as its error code", async () => {
    const { response, body } = await get("/api/v1/hello?name=admin")

    expect(response.status).toBe(400)
    expect(body).toEqual({ status: "error", error_code: "invalid_input" })
  })

  it("answers the health check at the root", async () => {
    const { response, body } = await get("/")

    expect(response.status).toBe(200)
    expect(body).toEqual({ status: "success", data: { status: "ok" } })
  })

  it("envelopes an unknown path", async () => {
    const { response, body } = await get("/nope")

    expect(response.status).toBe(404)
    expect(body).toEqual({
      status: "error",
      error_code: "endpoint_not_found",
    })
  })
})
