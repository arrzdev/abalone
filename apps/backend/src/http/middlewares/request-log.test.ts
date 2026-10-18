import { afterEach, describe, expect, it, vi } from "vitest"

type LogLine = Record<string, unknown>

function captureLines() {
  const lines: LogLine[] = []
  for (const method of ["log", "warn", "error"] as const) {
    vi.spyOn(console, method).mockImplementation((line: unknown) => {
      lines.push({ console: method, ...JSON.parse(String(line)) })
    })
  }
  return lines
}

//fresh imports per test, so each app gets its own module graph
async function app() {
  vi.resetModules()
  //hono/route reads a module-level symbol: Hono must come from the same fresh graph
  const { Hono } = await import("hono")
  const { requestLog } = await import("@/http/middlewares/request-log")
  const { errorCatcher } = await import("@/http/middlewares/error-catcher")
  const { Logger } = await import("@repo/shared/logging")
  const handlerLog = new Logger("handler")

  const server = new Hono()
  server.use("*", requestLog())
  server.onError(errorCatcher)
  server.get("/v1/jobs/:jobId", (c) => {
    handlerLog.info("job_read")
    return c.json({ ok: true })
  })
  server.get("/v1/me", (c) => {
    //what the auth middleware sets for a signed-in caller
    c.set("user" as never, { id: "user-1", username: "ana" } as never)
    return c.json({ ok: true })
  })
  server.get("/v1/boom", () => {
    throw new Error("boom")
  })

  //a guard that answers before the endpoint runs, like auth or a rate limit
  const keys = new Hono()
  keys.use("*", async (c, next) => {
    if (c.req.header("x-test-guard") === "deny")
      return c.json({ error: "unauthorized" }, 401)
    if (c.req.header("x-test-guard") === "crash") throw new Error("guard")
    await next()
  })
  keys.post("/:keyId", (c) => c.json({ ok: true }))
  server.route("/v1/keys", keys)
  //what the realtime route does: hand back the durable object's 101 untouched
  server.get("/v1/realtime", () => upgradeResponse)
  server.all("*", (c) => c.json({ error: "not_found" }, 404))
  return server
}

//a 101 carries its socket on a non-standard property; a copy loses it
const upgradeResponse = new Response(null, {
  status: 101,
  webSocket: new WebSocketPair()[1],
})

function requestLines(lines: LogLine[]): LogLine[] {
  return lines.filter((line) => line.message === "request")
}

describe("requestLog", () => {
  afterEach(() => vi.restoreAllMocks())

  it("keeps an incoming x-request-id and echoes it in the response", async () => {
    captureLines()
    const res = await (await app()).request("/v1/jobs/j1", {
      headers: { "x-request-id": "from-caller" },
    })
    expect(res.headers.get("x-request-id")).toBe("from-caller")
  })

  it("falls back to cf-ray, then to a random uuid", async () => {
    captureLines()
    const server = await app()
    const fromRay = await server.request("/v1/jobs/j1", {
      headers: { "cf-ray": "8f1e2d3c4b5a6978-LIS" },
    })
    expect(fromRay.headers.get("x-request-id")).toBe(
      "8f1e2d3c4b5a6978-LIS",
    )

    const generated = await server.request("/v1/jobs/j1")
    expect(generated.headers.get("x-request-id")).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    )
  })

  it("ignores an incoming x-request-id that is not a plain token", async () => {
    captureLines()
    const server = await app()
    for (const unsafe of [
      "a b",
      "x".repeat(129),
      '{"level":"error"}',
      "<script>",
    ]) {
      const res = await server.request("/v1/jobs/j1", {
        headers: {
          "x-request-id": unsafe,
          "cf-ray": "8f1e2d3c4b5a6978-LIS",
        },
      })
      expect(res.headers.get("x-request-id")).toBe("8f1e2d3c4b5a6978-LIS")
    }
    const valid = await server.request("/v1/jobs/j1", {
      headers: { "x-request-id": "Abc-1.2_3:4" },
    })
    expect(valid.headers.get("x-request-id")).toBe("Abc-1.2_3:4")
  })

  it("logs the endpoint pattern when a middleware answers first", async () => {
    const lines = captureLines()
    const res = await (await app()).request("/v1/keys/k1", {
      method: "POST",
      headers: { "x-test-guard": "deny" },
    })
    expect(res.status).toBe(401)
    expect(requestLines(lines)[0]).toMatchObject({
      status: 401,
      route: "/v1/keys/:keyId",
    })
  })

  it("logs the endpoint pattern when a middleware throws", async () => {
    const lines = captureLines()
    await (await app()).request("/v1/keys/k1", {
      method: "POST",
      headers: { "x-test-guard": "crash" },
    })
    const crash = lines.find(
      (entry) => entry.message === "api_unhandled_exception",
    )
    expect(crash?.route).toBe("/v1/keys/:keyId")
    expect(requestLines(lines)[0]?.route).toBe("/v1/keys/:keyId")
  })

  it("logs one request line with the route pattern, status and duration", async () => {
    const lines = captureLines()
    await (await app()).request("/v1/jobs/j1?token=secret", {
      headers: { "x-request-id": "req-1" },
    })
    const [line, ...rest] = requestLines(lines)
    expect(rest).toHaveLength(0)
    expect(line).toMatchObject({
      console: "log",
      level: "info",
      request_id: "req-1",
      method: "GET",
      route: "/v1/jobs/:jobId",
      status: 200,
    })
    expect(typeof line?.duration_ms).toBe("number")
    expect(JSON.stringify(lines)).not.toContain("secret")
  })

  it("gives every log line written while handling the request its request_id", async () => {
    const lines = captureLines()
    await (await app()).request("/v1/jobs/j1", {
      headers: { "x-request-id": "req-2" },
    })
    const handlerLine = lines.find((line) => line.message === "job_read")
    expect(handlerLine?.request_id).toBe("req-2")
  })

  it("adds the internal user id when the caller is signed in", async () => {
    const lines = captureLines()
    await (await app()).request("/v1/me")
    expect(requestLines(lines)[0]?.user_id).toBe("user-1")
  })

  it("logs a 5xx at error level, with the stack line carrying the same request_id", async () => {
    const lines = captureLines()
    const res = await (await app()).request("/v1/boom", {
      headers: { "x-request-id": "req-3" },
    })
    expect(res.status).toBe(500)
    expect(res.headers.get("x-request-id")).toBe("req-3")

    const [line] = requestLines(lines)
    expect(line).toMatchObject({
      console: "error",
      level: "error",
      route: "/v1/boom",
      status: 500,
    })

    const crash = lines.find(
      (entry) => entry.message === "api_unhandled_exception",
    )
    expect(crash?.request_id).toBe("req-3")
    expect(JSON.stringify(crash)).toContain("boom")
  })

  it("returns the request_id in the body of an unexpected error", async () => {
    captureLines()
    const res = await (await app()).request("/v1/boom", {
      headers: { "x-request-id": "req-4" },
    })
    expect(await res.json()).toEqual({
      status: "error",
      error_code: "internal_server_error",
      request_id: "req-4",
    })
  })

  it("passes a websocket upgrade through as the same response, still logged", async () => {
    const lines = captureLines()
    const res = await (await app()).request("/v1/realtime", {
      headers: { upgrade: "websocket", "x-request-id": "req-ws" },
    })
    //the durable object's 101 has immutable headers: nothing may be written to it
    expect(res).toBe(upgradeResponse)
    expect(res.webSocket).not.toBeNull()
    expect(res.headers.get("x-request-id")).toBeNull()
    expect(requestLines(lines)[0]).toMatchObject({
      request_id: "req-ws",
      route: "/v1/realtime",
      status: 101,
    })
  })

  it("logs a 4xx at info level", async () => {
    const lines = captureLines()
    await (await app()).request("/nope")
    expect(requestLines(lines)[0]).toMatchObject({
      level: "info",
      status: 404,
      route: "/*",
    })
  })
})
