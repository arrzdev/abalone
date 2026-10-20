import { env } from "cloudflare:workers"
import { Hono } from "hono"
import { beforeAll, beforeEach, describe, expect, it } from "vitest"
import { envRegistry } from "@/env/registry"
import {
  rateLimit,
  resetRateLimitBuckets,
} from "@/http/middlewares/rate-limit"
import { inOneRateLimitWindow } from "@/test-support/rate-limit-window"

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

  it("counts a preset with bindings through every one of them, keyed by ip and preset", async () => {
    const keys: string[] = []
    let isOverLimit = false
    const limiter: RateLimit = {
      async limit(options) {
        keys.push(options.key)
        return { success: !isOverLimit }
      },
    }
    const app = new Hono()
      .use("*", rateLimit("auth"))
      .get("/", (c) => c.json({ ok: true }))
    const request = {
      headers: { "cf-connecting-ip": "203.0.113.7" },
    }

    const bindings = {
      AUTH_BURST_RATE_LIMITER: limiter,
      AUTH_SUSTAINED_RATE_LIMITER: limiter,
    }

    const allowed = await app.request(
      "http://example.com/",
      request,
      bindings,
    )
    expect(allowed.status).toBe(200)

    isOverLimit = true
    const limited = await app.request(
      "http://example.com/",
      request,
      bindings,
    )
    expect(limited.status).toBe(429)
    expect(keys).toEqual(Array(4).fill("203.0.113.7:auth"))
  })

  it("sheds the request after the limit on the binding wrangler.toml declares", async () => {
    const app = new Hono()
      .use("*", rateLimit("invite-link"))
      .get("/", (c) => c.json({ ok: true }))
    const request = {
      headers: { "cf-connecting-ip": "203.0.113.8" },
    }
    //miniflare builds it from the dev block, so this is the real binding
    expect(env.INVITE_LINK_RATE_LIMITER).toBeDefined()
    await inOneRateLimitWindow(60, 3_000)

    for (let index = 0; index < 20; index++) {
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
      .use("*", rateLimit("auth"))
      .get("/", (c) => c.json({ ok: true }))

    const response = await app.request(
      "http://example.com/",
      { headers: { "x-test-bypass": "true" } },
      {
        AUTH_BURST_RATE_LIMITER: limiter,
        AUTH_SUSTAINED_RATE_LIMITER: limiter,
      },
    )
    expect(response.status).toBe(200)
    expect(calls).toBe(0)
  })

  //the `auth` preset's own ceiling is its sustained tier, 20 per 60 s
  it("falls back to the per-isolate count when the bindings are absent", async () => {
    const app = new Hono()
      .use("*", rateLimit("auth"))
      .get("/", (c) => c.json({ ok: true }))

    for (let index = 0; index < 20; index++) {
      const response = await app.request("http://example.com/")
      expect(response.status).toBe(200)
    }

    const limited = await app.request("http://example.com/")
    expect(limited.status).toBe(429)
  })

  //---- the auth standard (stack-auth): binding tiers ----------------

  //sign-in and sign-up are counted by two bindings: a burst (5 / 10 s) and a
  //sustained ceiling (20 / 60 s). either one over sheds the request.
  it("passes an auth request only when both its burst and sustained bindings do", async () => {
    let isBurstOver = false
    let isSustainedOver = false
    const burst: RateLimit = {
      async limit() {
        return { success: !isBurstOver }
      },
    }
    const sustained: RateLimit = {
      async limit() {
        return { success: !isSustainedOver }
      },
    }
    const bindings = {
      AUTH_BURST_RATE_LIMITER: burst,
      AUTH_SUSTAINED_RATE_LIMITER: sustained,
    }
    const app = new Hono()
      .use("*", rateLimit("auth"))
      .get("/", (c) => c.json({ ok: true }))
    const request = { headers: { "cf-connecting-ip": "203.0.113.40" } }

    expect((await app.request("/", request, bindings)).status).toBe(200)

    isBurstOver = true
    const burstLimited = await app.request("/", request, bindings)
    expect(burstLimited.status).toBe(429)
    expect(
      Number(burstLimited.headers.get("Retry-After")),
    ).toBeGreaterThan(0)

    isBurstOver = false
    isSustainedOver = true
    const sustainedLimited = await app.request("/", request, bindings)
    expect(sustainedLimited.status).toBe(429)
    expect(
      Number(sustainedLimited.headers.get("Retry-After")),
    ).toBeGreaterThan(0)
  })

  //every 429 tells the client when to come back, whichever limiter said no
  it("sends Retry-After with every 429", async () => {
    const overLimit: RateLimit = {
      async limit() {
        return { success: false }
      },
    }
    const bound = new Hono()
      .use("*", rateLimit("health"))
      .get("/", (c) => c.json({ ok: true }))
    const boundLimited = await bound.request(
      "/",
      {},
      {
        HEALTH_RATE_LIMITER: overLimit,
      },
    )
    expect(boundLimited.status).toBe(429)
    expect(
      Number(boundLimited.headers.get("Retry-After")),
    ).toBeGreaterThan(0)

    const counted = new Hono()
      .use("*", rateLimit("upload"))
      .get("/", (c) => c.json({ ok: true }))
    for (let index = 0; index < 10; index++) await counted.request("/")
    const countedLimited = await counted.request("/")
    expect(countedLimited.status).toBe(429)
    expect(
      Number(countedLimited.headers.get("Retry-After")),
    ).toBeGreaterThan(0)
  })
})
