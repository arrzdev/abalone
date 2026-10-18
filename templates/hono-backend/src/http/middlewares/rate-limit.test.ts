import { env } from "cloudflare:workers"
import { Hono } from "hono"
import { beforeAll, beforeEach, describe, expect, it } from "vitest"
import { envRegistry } from "@/env/registry"
import {
  rateLimit,
  resetRateLimitBuckets,
} from "@/http/middlewares/rate-limit"

//exercise the limiter on a throwaway app (no DB) and, crucially, WITHOUT the
//x-test-bypass header so hits actually count. the "api" preset is 120/min, so
//120 pass and the 121st is shed. regression guard for the bug where the
//empty-bucket branch skipped recording the hit, making the limit unreachable.
describe("rate limit middleware", () => {
  beforeAll(() => {
    //the middleware reads RATE_LIMIT_ALLOW_TEST_BYPASS off the env registry;
    //seed it from the test worker bindings (worker.fetch does this in the app).
    envRegistry.setEnv(env as unknown as Record<string, unknown>)
  })

  beforeEach(() => {
    resetRateLimitBuckets()
  })

  it("allows requests up to the limit then returns 429", async () => {
    const app = new Hono()
      .use("*", rateLimit("api"))
      .get("/", (c) => c.json({ ok: true }))

    for (let index = 0; index < 120; index++) {
      const response = await app.request("http://example.com/")
      expect(response.status).toBe(200)
    }

    const limited = await app.request("http://example.com/")
    expect(limited.status).toBe(429)
  })

  it("counts a preset with a binding through that binding, keyed by ip and preset", async () => {
    const keys: string[] = []
    let isOverLimit = false
    const limiter: RateLimit = {
      async limit(options) {
        keys.push(options.key)
        return { success: !isOverLimit }
      },
    }
    const app = new Hono()
      .use("*", rateLimit("health"))
      .get("/", (c) => c.json({ ok: true }))
    const request = {
      headers: { "cf-connecting-ip": "203.0.113.7" },
    }

    const allowed = await app.request("http://example.com/", request, {
      HEALTH_RATE_LIMITER: limiter,
    })
    expect(allowed.status).toBe(200)

    isOverLimit = true
    const limited = await app.request("http://example.com/", request, {
      HEALTH_RATE_LIMITER: limiter,
    })
    expect(limited.status).toBe(429)
    expect(keys).toEqual(["203.0.113.7:health", "203.0.113.7:health"])
  })

  it("sheds the request after the limit on the binding wrangler.toml declares", async () => {
    const app = new Hono()
      .use("*", rateLimit("health"))
      .get("/", (c) => c.json({ ok: true }))
    const request = {
      headers: { "cf-connecting-ip": "203.0.113.8" },
    }
    //miniflare builds it from the dev block, so this is the real binding
    expect(env.HEALTH_RATE_LIMITER).toBeDefined()

    for (let index = 0; index < 60; index++) {
      const response = await app.request(
        "http://example.com/",
        request,
        env,
      )
      expect(response.status).toBe(200)
    }

    const limited = await app.request("http://example.com/", request, env)
    expect(limited.status).toBe(429)
  })

  it("skips the binding when the test bypass is on", async () => {
    let calls = 0
    const limiter: RateLimit = {
      async limit() {
        calls++
        return { success: false }
      },
    }
    const app = new Hono()
      .use("*", rateLimit("health"))
      .get("/", (c) => c.json({ ok: true }))

    const response = await app.request(
      "http://example.com/",
      { headers: { "x-test-bypass": "true" } },
      { HEALTH_RATE_LIMITER: limiter },
    )
    expect(response.status).toBe(200)
    expect(calls).toBe(0)
  })

  it("falls back to the per-isolate count when the binding is absent", async () => {
    const app = new Hono()
      .use("*", rateLimit("health"))
      .get("/", (c) => c.json({ ok: true }))

    for (let index = 0; index < 60; index++) {
      const response = await app.request("http://example.com/")
      expect(response.status).toBe(200)
    }

    const limited = await app.request("http://example.com/")
    expect(limited.status).toBe(429)
  })
})
