import { env } from "cloudflare:workers"
import { beforeAll, describe, expect, it } from "vitest"
import worker from "@/entrypoint"
import { envRegistry } from "@/env/registry"
import { newExecutionContext } from "@/test-support/execution-context"

//the allowlist is a list, so what these cover is that every configured origin
//gets through and nothing else does. the suite runs with two public origins
//(vitest.config.ts), which is what production looks like.

describe("cors allowlist", () => {
  beforeAll(() => {
    envRegistry.setEnv(env as unknown as Record<string, unknown>)
  })

  function preflight(origin: string) {
    return worker.fetch(
      new Request("http://example.com/api/v1/auth/get-session", {
        method: "OPTIONS",
        headers: {
          origin,
          "access-control-request-method": "GET",
          "x-test-bypass": "true",
        },
      }),
      env as never,
      newExecutionContext(),
    )
  }

  it("reflects the first configured origin", async () => {
    const response = await preflight("http://example.com")

    expect(response.headers.get("access-control-allow-origin")).toBe(
      "http://example.com",
    )
  })

  it("reflects a later configured origin too", async () => {
    const response = await preflight("http://second.example.com")

    expect(response.headers.get("access-control-allow-origin")).toBe(
      "http://second.example.com",
    )
  })

  it("refuses an origin that is not configured", async () => {
    const response = await preflight("http://attacker.example.net")

    expect(response.headers.get("access-control-allow-origin")).toBeNull()
  })

  //a public frontend means allowsPrivateOrigins() is false, so the dev-only
  //localhost reflection must not happen here
  it("refuses a private origin against a public frontend", async () => {
    const response = await preflight("http://localhost:6161")

    expect(response.headers.get("access-control-allow-origin")).toBeNull()
  })

  //a 101 from a durable object has immutable headers and carries the socket on
  //a property, so anything written onto it afterwards either throws or loses
  //the socket. the plugin has to stand aside, and this is what says it does.
  it("leaves a websocket upgrade alone", async () => {
    const response = await worker.fetch(
      new Request("http://example.com/api/v1/realtime", {
        headers: {
          upgrade: "websocket",
          origin: "http://example.com",
          "x-test-bypass": "true",
        },
      }),
      env as never,
      newExecutionContext(),
    )

    //no ticket, so the route turns it down — but it is the route turning it
    //down, and no cors header was written on the way back out
    expect(response.status).toBe(401)
    expect(response.headers.get("access-control-allow-origin")).toBeNull()
  })
})
