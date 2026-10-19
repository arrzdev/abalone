import { env } from "cloudflare:workers"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import worker from "@/entrypoint"
import { envRegistry } from "@/env/registry"
import { envSchema } from "@/env/schema"
import { newExecutionContext } from "@/test-support/execution-context"

type LogLine = Record<string, unknown>

function captureLines() {
  const lines: LogLine[] = []
  for (const method of ["log", "warn", "error"] as const) {
    vi.spyOn(console, method).mockImplementation((line: unknown) => {
      lines.push(JSON.parse(String(line)))
    })
  }
  return lines
}

//the whole worker, as deployed: the entrypoint configures the logger from the
//env, so every line names the service, the environment and the build
function fetchWorker(path: string, bindings: Record<string, unknown>) {
  return worker.fetch(
    new Request(`http://example.com${path}`, {
      headers: { "x-request-id": "req-entry" },
    }),
    { ...env, ...bindings } as never,
    newExecutionContext(),
  )
}

describe("the request line through the worker entrypoint", () => {
  beforeAll(() => {
    envRegistry.setEnv(env as unknown as Record<string, unknown>)
  })
  afterEach(() => vi.restoreAllMocks())

  it("writes one line with time, service, env, build_sha and the error_code", async () => {
    const lines = captureLines()
    const response = await fetchWorker("/api/v1/nope", {
      DEPLOY_ENV: "production",
      BUILD_SHA: "abc1234",
    })
    expect(response.status).toBe(404)
    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatchObject({
      level: "info",
      context: "request",
      message: "request",
      time: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      service: "hono-backend",
      env: "production",
      build_sha: "abc1234",
      request_id: "req-entry",
      method: "GET",
      route: "/*",
      status: 404,
      error_code: "endpoint_not_found",
    })
    expect(typeof lines[0]?.duration_ms).toBe("number")
  })

  it("names a build with no BUILD_SHA and no DEPLOY_ENV local", async () => {
    const lines = captureLines()
    await fetchWorker("/api/v1/nope", {
      DEPLOY_ENV: undefined,
      BUILD_SHA: undefined,
    })
    expect(lines[0]).toMatchObject({ env: "local", build_sha: "local" })
  })

  it("does not write lines below LOG_LEVEL", async () => {
    const lines = captureLines()
    await fetchWorker("/api/v1/nope", { LOG_LEVEL: "warn" })
    expect(lines).toHaveLength(0)
    await fetchWorker("/api/v1/nope", { LOG_LEVEL: "info" })
    expect(lines).toHaveLength(1)
  })
})

describe("LOG_LEVEL in the env schema", () => {
  const base = {
    FRONTEND_URLS: "http://example.com",
  }

  it("defaults to info", () => {
    const parsed = envSchema.parse(base) as Record<string, unknown>
    expect(parsed.LOG_LEVEL).toBe("info")
  })

  it.each(["debug", "info", "warn", "error"])("accepts %s", (level) => {
    expect(
      envSchema.safeParse({ ...base, LOG_LEVEL: level }).success,
    ).toBe(true)
  })

  it("refuses any other value", () => {
    expect(
      envSchema.safeParse({ ...base, LOG_LEVEL: "verbose" }).success,
    ).toBe(false)
  })
})
