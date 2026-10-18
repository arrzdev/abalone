import { afterEach, describe, expect, it, vi } from "vitest"

const capture = (method: "log" | "warn" | "error") => {
  const spy = vi.spyOn(console, method).mockImplementation(() => {})
  return () => JSON.parse(spy.mock.calls[0]?.[0] as string)
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
