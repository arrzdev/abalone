import { afterEach, describe, expect, it, vi } from "vitest"

const capture = (method: "log" | "warn" | "error") => {
  const spy = vi.spyOn(console, method).mockImplementation(() => {})
  return () => JSON.parse(spy.mock.calls[0]?.[0] as string)
}

const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

//every line a capture saw, parsed
const captureAll = () => {
  const lines: Record<string, unknown>[] = []
  for (const method of ["log", "warn", "error"] as const) {
    vi.spyOn(console, method).mockImplementation((line: unknown) => {
      lines.push(JSON.parse(String(line)))
    })
  }
  return lines
}

const freshModule = async () => {
  vi.resetModules()
  return await import("@repo/shared/logging")
}

//a reset import gives each test a fresh logger module
const freshLogger = async (context: string) => {
  vi.resetModules()
  const { Logger } = await import("@repo/shared/logging")
  return new Logger(context)
}

//the request context lives in a server-only module: the game's browser code
//imports the logger too, and node:async_hooks must stay out of that bundle
const freshLogging = async () => {
  vi.resetModules()
  const { Logger } = await import("@repo/shared/logging")
  const { withLogContext } = await import("@repo/shared/log-context")
  return { Logger, withLogContext }
}

describe("Logger", () => {
  afterEach(() => vi.restoreAllMocks())

  it("writes one JSON line with level, context and message", async () => {
    const read = capture("log")
    const logger = await freshLogger("jobs")
    logger.info("started")
    expect(read()).toEqual({
      level: "info",
      context: "jobs",
      message: "started",
      time: expect.stringMatching(ISO_TIME),
    })
  })

  it("routes warn and error to their console methods", async () => {
    const warn = capture("warn")
    const error = capture("error")
    const logger = await freshLogger("x")
    logger.warn("w")
    logger.error("e")
    expect(warn().level).toBe("warn")
    expect(error().level).toBe("error")
  })

  it("keeps an Error argument with name, message, stack and cause", async () => {
    const read = capture("error")
    const logger = await freshLogger("x")
    logger.error("failed", new Error("boom", { cause: new Error("root") }))
    const [arg] = read().args
    expect(arg).toMatchObject({ name: "Error", message: "boom" })
    expect(arg.stack).toContain("boom")
    expect(arg.cause.message).toBe("root")
  })

  it("keeps Errors nested in objects", async () => {
    const read = capture("error")
    const logger = await freshLogger("x")
    logger.error("failed", { error: new Error("nested") })
    expect(read().error.message).toBe("nested")
  })

  it("writes a single object argument as top-level fields", async () => {
    const read = capture("log")
    const logger = await freshLogger("jobs")
    logger.info("job_done", { job_id: "j1", duration_ms: 12 })
    expect(read()).toEqual({
      level: "info",
      context: "jobs",
      message: "job_done",
      time: expect.stringMatching(ISO_TIME),
      job_id: "j1",
      duration_ms: 12,
    })
  })

  it("never lets fields overwrite level, context or message", async () => {
    const read = capture("log")
    const logger = await freshLogger("jobs")
    logger.info("started", { level: "error", message: "spoofed" })
    expect(read()).toMatchObject({ level: "info", message: "started" })
  })

  it("redacts authorization and cookie values at any depth", async () => {
    const read = capture("warn")
    const logger = await freshLogger("x")
    logger.warn("headers", {
      Authorization: "Bearer vl_secret",
      headers: {
        cookie: "session=abc",
        "set-cookie": "a=b",
        accept: "*/*",
      },
    })
    const line = read()
    expect(line.Authorization).toBe("[redacted]")
    expect(line.headers).toEqual({
      cookie: "[redacted]",
      "set-cookie": "[redacted]",
      accept: "*/*",
    })
    expect(JSON.stringify(line)).not.toContain("vl_secret")
  })

  it("adds the request_id of the running log context to every line", async () => {
    const read = capture("log")
    const { Logger, withLogContext } = await freshLogging()
    const logger = new Logger("jobs")
    await withLogContext({ request_id: "req-1" }, async () => {
      await Promise.resolve()
      logger.info("inside")
    })
    expect(read()).toMatchObject({
      message: "inside",
      request_id: "req-1",
    })
  })

  it("writes no request_id outside a log context", async () => {
    const read = capture("log")
    const logger = await freshLogger("jobs")
    logger.info("outside")
    expect(read()).not.toHaveProperty("request_id")
  })

  it("never throws on circular args", async () => {
    const read = capture("error")
    const logger = await freshLogger("x")
    const loop: Record<string, unknown> = {}
    loop.self = loop
    logger.error("failed", loop)
    expect(read().args).toBe("[unserializable]")
  })
})

describe("Logger levels (LOG_LEVEL)", () => {
  afterEach(() => vi.restoreAllMocks())

  it("drops debug lines at the default level, info", async () => {
    const lines = captureAll()
    const { Logger } = await freshModule()
    const logger = new Logger("x")
    logger.debug("detail")
    logger.info("kept")
    expect(lines.map((line) => line.message)).toEqual(["kept"])
  })

  it("writes debug lines through console.log when the level is debug", async () => {
    const read = capture("log")
    const { Logger, configureLogging } = await freshModule()
    configureLogging({ level: "debug" })
    new Logger("x").debug("plan.resolved", { plan: "pro" })
    expect(read()).toMatchObject({
      level: "debug",
      message: "plan.resolved",
      plan: "pro",
    })
  })

  it.each([
    ["info", ["info", "warn", "error"]],
    ["warn", ["warn", "error"]],
    ["error", ["error"]],
  ])("at %s writes only %j", async (level, written) => {
    const lines = captureAll()
    const { Logger, configureLogging } = await freshModule()
    configureLogging({ level })
    const logger = new Logger("x")
    logger.debug("debug")
    logger.info("info")
    logger.warn("warn")
    logger.error("error")
    expect(lines.map((line) => line.level)).toEqual(written)
  })

  it("treats an unknown or missing level as info", async () => {
    const lines = captureAll()
    const { Logger, configureLogging } = await freshModule()
    configureLogging({ level: "verbose" })
    new Logger("x").debug("dropped")
    configureLogging({})
    new Logger("x").debug("dropped too")
    new Logger("x").info("kept")
    expect(lines.map((line) => line.message)).toEqual(["kept"])
  })
})

describe("Logger service fields", () => {
  afterEach(() => vi.restoreAllMocks())

  it("puts service, env and build_sha on every line once configured", async () => {
    const lines = captureAll()
    const { Logger, configureLogging } = await freshModule()
    configureLogging({
      service: "hono-backend",
      env: "production",
      build_sha: "abc1234",
    })
    const logger = new Logger("x")
    logger.info("a")
    logger.error("b", { service: "spoofed" })
    for (const line of lines)
      expect(line).toMatchObject({
        service: "hono-backend",
        env: "production",
        build_sha: "abc1234",
        time: expect.stringMatching(ISO_TIME),
      })
  })
})

describe("Logger redaction (logging standard §6)", () => {
  afterEach(() => vi.restoreAllMocks())

  async function written(fields: Record<string, unknown>) {
    const read = capture("log")
    const logger = await freshLogger("x")
    logger.info("redaction", fields)
    return read()
  }

  it.each([
    "authorization",
    "cookie",
    "set-cookie",
    "password",
    "pass",
    "secret",
    "token",
    "access_token",
    "refresh_token",
    "id_token",
    "api_key",
    "apikey",
    "key_hash",
    "session",
    "session_id",
    "card",
    "card_number",
    "cvc",
    "iban",
    "phone",
    "body",
    "raw_body",
  ])("redacts the %s key", async (key) => {
    const line = await written({ [key]: "s3cr3t-value" })
    expect(line[key]).toBe("[redacted]")
    expect(JSON.stringify(line)).not.toContain("s3cr3t-value")
  })

  it("matches deny-listed keys whatever their case, - or _", async () => {
    const line = await written({
      "Api-Key": "v1",
      ACCESS_TOKEN: "v2",
      refreshToken: "v3",
      Set_Cookie: "v4",
      rawBody: "v5",
    })
    expect(line).toMatchObject({
      "Api-Key": "[redacted]",
      ACCESS_TOKEN: "[redacted]",
      refreshToken: "[redacted]",
      Set_Cookie: "[redacted]",
      rawBody: "[redacted]",
    })
  })

  it("keeps keys that only contain a deny-listed word", async () => {
    const line = await written({
      token_count: 3,
      passed: true,
      user_id: "u1",
    })
    expect(line).toMatchObject({
      token_count: 3,
      passed: true,
      user_id: "u1",
    })
  })

  it("masks any key ending in email to first letter and domain", async () => {
    const line = await written({
      email: "ana.silva@example.com",
      user_email: "bruno@tudu.dev",
      contactEmail: "carla@example.org",
    })
    expect(line).toMatchObject({
      email: "a***@example.com",
      user_email: "b***@tudu.dev",
      contactEmail: "c***@example.org",
    })
  })

  it("redacts an email value that is not an address", async () => {
    const line = await written({ email: "not-an-address" })
    expect(line.email).toBe("[redacted]")
  })

  it("redacts a Bearer credential in any string", async () => {
    const line = await written({ note: "Bearer vl_abc.def-123" })
    expect(line.note).toBe("[redacted]")
  })

  it("redacts a JWT inside a longer string", async () => {
    const jwt =
      "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1MSJ9.sflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
    const line = await written({ note: `rejected ${jwt} at the edge` })
    expect(line.note).toBe("rejected [redacted] at the edge")
  })

  it.each([
    "sk_live_51Habcdef0123",
    "sk_test_51Habcdef0123",
    "rk_live_51Habcdef0123",
    "whsec_abcdef0123",
  ])("redacts the Stripe key %s", async (key) => {
    const line = await written({ note: `key ${key} failed` })
    expect(line.note).toBe("key [redacted] failed")
  })

  it("keeps Stripe object ids, which are allowed", async () => {
    const line = await written({ payment_intent: "pi_3Pabc123" })
    expect(line.payment_intent).toBe("pi_3Pabc123")
  })

  it("redacts at any depth, arrays included", async () => {
    const line = await written({
      request: {
        headers: { Authorization: "Bearer x", accept: "*/*" },
        user: { id: "u1", email: "dora@example.com" },
      },
      attempts: [{ token: "t1" }, { note: "sk_live_abc123" }],
    })
    expect(line.request).toEqual({
      headers: { Authorization: "[redacted]", accept: "*/*" },
      user: { id: "u1", email: "d***@example.com" },
    })
    expect(line.attempts).toEqual([
      { token: "[redacted]" },
      { note: "[redacted]" },
    ])
  })

  it("redacts a token inside an Error message, its stack and its cause", async () => {
    const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1MSJ9.c2lnbmF0dXJl"
    const line = await written({
      error: new Error(`upstream refused ${jwt}`, {
        cause: new Error("Bearer abc123"),
      }),
    })
    const error = line.error as Record<string, unknown>
    expect(error.message).toBe("upstream refused [redacted]")
    expect(JSON.stringify(line)).not.toContain(jwt)
    expect(JSON.stringify(line)).not.toContain("abc123")
    expect(error.name).toBe("Error")
  })
})
