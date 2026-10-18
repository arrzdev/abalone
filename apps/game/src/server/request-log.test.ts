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

//fresh imports: the logger reads the request context the log-context module installs
async function fresh() {
  vi.resetModules()
  const { withRequestLog, routePatternOf } = await import(
    "@/server/request-log"
  )
  const { Logger } = await import("@repo/shared/logging")
  return { withRequestLog, routePatternOf, Logger }
}

function get(path: string, headers: Record<string, string> = {}) {
  return new Request(`https://abalone.tudu.dev${path}`, { headers })
}

const TOKEN = "A".repeat(43)

describe("withRequestLog", () => {
  afterEach(() => vi.restoreAllMocks())

  it("keeps a valid x-request-id, else cf-ray, else a new uuid, and echoes it", async () => {
    captureLines()
    const { withRequestLog } = await fresh()
    const ok = async () => new Response("ok")

    const kept = await withRequestLog(
      get("/", { "x-request-id": "req-1" }),
      ok,
    )
    expect(kept.headers.get("x-request-id")).toBe("req-1")

    const fromRay = await withRequestLog(
      get("/", { "x-request-id": "not valid", "cf-ray": "8f1e2d3c-LIS" }),
      ok,
    )
    expect(fromRay.headers.get("x-request-id")).toBe("8f1e2d3c-LIS")

    const generated = await withRequestLog(get("/"), ok)
    expect(generated.headers.get("x-request-id")).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    )
  })

  it("hands the request id to the handler, for the backend call", async () => {
    captureLines()
    const { withRequestLog } = await fresh()
    let seen = ""
    await withRequestLog(
      get("/", { "x-request-id": "req-2" }),
      async (id) => {
        seen = id
        return new Response("ok")
      },
    )
    expect(seen).toBe("req-2")
  })

  it("logs one request line with the route pattern, status and duration", async () => {
    const lines = captureLines()
    const { withRequestLog } = await fresh()
    await withRequestLog(
      get(`/invite/${TOKEN}?ref=chat`, { "x-request-id": "req-3" }),
      async () => new Response("<html>", { status: 200 }),
    )
    const requestLines = lines.filter((line) => line.message === "request")
    expect(requestLines).toHaveLength(1)
    expect(requestLines[0]).toMatchObject({
      console: "log",
      level: "info",
      request_id: "req-3",
      method: "GET",
      route: "/invite/:linkId",
      status: 200,
    })
    expect(typeof requestLines[0]?.duration_ms).toBe("number")
    expect(JSON.stringify(lines)).not.toContain(TOKEN)
    expect(JSON.stringify(lines)).not.toContain("ref=chat")
  })

  it("gives every line written while handling the request its request_id", async () => {
    const lines = captureLines()
    const { withRequestLog, Logger } = await fresh()
    const log = new Logger("invite")
    await withRequestLog(
      get("/", { "x-request-id": "req-4" }),
      async () => {
        await Promise.resolve()
        log.warn("invite_read_failed")
        return new Response("ok")
      },
    )
    const line = lines.find(
      (entry) => entry.message === "invite_read_failed",
    )
    expect(line?.request_id).toBe("req-4")
  })

  it("logs a 5xx at error level", async () => {
    const lines = captureLines()
    const { withRequestLog } = await fresh()
    await withRequestLog(
      get("/online"),
      async () => new Response("down", { status: 503 }),
    )
    expect(lines.find((line) => line.message === "request")).toMatchObject(
      {
        console: "error",
        level: "error",
        status: 503,
      },
    )
  })

  it("logs a thrown error with its stack and request_id, then rethrows it", async () => {
    const lines = captureLines()
    const { withRequestLog } = await fresh()
    function renderPage(): never {
      throw new Error("render failed")
    }
    await expect(
      withRequestLog(
        get("/rules", { "x-request-id": "req-5" }),
        async () => renderPage(),
      ),
    ).rejects.toThrow("render failed")

    const crash = lines.find(
      (line) => line.message === "game_unhandled_exception",
    )
    expect(crash).toMatchObject({
      level: "error",
      request_id: "req-5",
      route: "/rules",
    })
    expect(JSON.stringify(crash)).toContain("renderPage")
    expect(lines.find((line) => line.message === "request")).toMatchObject(
      {
        level: "error",
        status: 500,
      },
    )
  })
})

describe("routePatternOf", () => {
  it("names the route, never an id or a token", async () => {
    const { routePatternOf } = await fresh()
    expect(routePatternOf(`/invite/${TOKEN}`)).toBe("/invite/:linkId")
    expect(routePatternOf("/online/0f9c3a52-7d1e")).toBe("/online/:gameId")
    expect(routePatternOf("/game/online/0f9c3a52-7d1e")).toBe(
      "/game/online/:gameId",
    )
    expect(routePatternOf("/online/history")).toBe("/online/history")
    expect(routePatternOf("/")).toBe("/")
    expect(routePatternOf("/opening-moves")).toBe("/opening-moves")
    expect(routePatternOf("/assets/index-B2x9.js")).toBe("*")
    expect(routePatternOf("/wp-login.php")).toBe("*")
  })
})
