import { Hono } from "hono"
import { describe, expect, it, vi } from "vitest"
import { error, ok } from "@/http/envelope"
import type { ErrorCode } from "@/http/errors"
import { CustomError, ERROR_CODES, RetryLaterError } from "@/http/errors"
import { errorCatcher } from "@/http/middlewares/error-catcher"
import { requestLog } from "@/http/middlewares/request-log"

//the catcher on a throwaway app wired like the real one, so what answers is the
//catcher and not a route. request-log.test.ts covers what it adds to the request
//line; the request log is here because it hands the catcher what Hono will not
//(a thrown value that is not an Error) and sets the request id.

type Body = Record<string, unknown>

const SECRET = "d1 says: no such table users_v2 at /srv/worker.js:42"

function appThatThrows(thrown: () => unknown) {
  const app = new Hono()
  app.use("*", requestLog())
  app.get("/", () => {
    throw thrown()
  })
  app.onError(errorCatcher)
  return app
}

async function call(thrown: () => unknown) {
  //the request log writes one line per request; keep the run output readable
  const lines = vi.spyOn(console, "error").mockImplementation(() => {})
  const info = vi.spyOn(console, "log").mockImplementation(() => {})
  const response = await appThatThrows(thrown).request("/", {
    headers: { "x-request-id": "req-123" },
  })
  lines.mockRestore()
  info.mockRestore()
  return { response, text: await response.clone().text() }
}

describe("errorCatcher", () => {
  //---- known errors ----------------

  it.each(
    Object.entries(ERROR_CODES) as [
      ErrorCode,
      (typeof ERROR_CODES)[ErrorCode],
    ][],
  )(
    "answers %s with its own status and envelope",
    async (code, [, status]) => {
      const { response, text } = await call(() => new CustomError(code))

      expect(response.status).toBe(status)
      expect(JSON.parse(text)).toEqual({
        status: "error",
        error_code: code,
      })
    },
  )

  it("does not leak the cause of a known error", async () => {
    const { response, text } = await call(
      () => new CustomError("service_unavailable", new Error(SECRET)),
    )

    expect(response.status).toBe(503)
    expect(text).not.toContain("users_v2")
    expect(text).not.toContain("worker.js")
  })

  it("tells a rate-limited caller when to come back", async () => {
    const { response } = await call(
      () => new CustomError("rate_limit_exceeded"),
    )

    expect(response.status).toBe(429)
    expect(response.headers.get("retry-after")).toBe("60")
  })

  it("tells a locked-out caller exactly when to come back", async () => {
    const { response, text } = await call(
      () => new RetryLaterError("auth_account_locked", 900),
    )

    expect(response.status).toBe(429)
    expect(response.headers.get("retry-after")).toBe("900")
    expect(JSON.parse(text)).toEqual({
      status: "error",
      error_code: "auth_account_locked",
    })
  })

  it("sends no Retry-After with an error that is not a 429", async () => {
    const { response } = await call(() => new CustomError("not_found"))

    expect(response.headers.get("retry-after")).toBeNull()
  })

  //---- unknown errors ----------------

  it("answers an unexpected error with a 500 and nothing internal", async () => {
    const { response, text } = await call(
      () => new Error(SECRET, { cause: new Error("root cause") }),
    )

    expect(response.status).toBe(500)
    expect(JSON.parse(text)).toEqual({
      status: "error",
      error_code: "internal_server_error",
      request_id: "req-123",
    })
    for (const leak of ["users_v2", "worker.js", "root cause", "at "])
      expect(text).not.toContain(leak)
  })

  it("answers a thrown value that is not an Error the same way", async () => {
    const { response, text } = await call(() => SECRET)

    expect(response.status).toBe(500)
    expect(JSON.parse(text)).toEqual({
      status: "error",
      error_code: "internal_server_error",
      request_id: "req-123",
    })
  })

  it("treats a plain Error named like a known code as unknown", async () => {
    //only a CustomError picks its status; a message that happens to match a
    //code must not turn a crash into a 404
    const { response, text } = await call(() => new Error("not_found"))

    expect(response.status).toBe(500)
    expect(JSON.parse(text)).toMatchObject({
      error_code: "internal_server_error",
    })
  })
})

describe("envelope", () => {
  const app = new Hono()
    .get("/empty", (c) => ok(c))
    .get("/data", (c) => ok(c, { id: "g1" }))
    .get("/created", (c) => ok(c, { id: "g2" }, 201))
    .get("/refused", (c) => error(c, "game_not_active"))

  async function read(path: string) {
    const response = await app.request(path)
    return {
      status: response.status,
      body: (await response.json()) as Body,
    }
  }

  it("answers ok() alone with a bare success", async () => {
    expect(await read("/empty")).toEqual({
      status: 200,
      body: { status: "success" },
    })
  })

  it("wraps data in a success envelope", async () => {
    expect(await read("/data")).toEqual({
      status: 200,
      body: { status: "success", data: { id: "g1" } },
    })
  })

  it("keeps the status a route asks for", async () => {
    expect(await read("/created")).toEqual({
      status: 201,
      body: { status: "success", data: { id: "g2" } },
    })
  })

  it("answers error() with the code's status and no message", async () => {
    expect(await read("/refused")).toEqual({
      status: 409,
      body: { status: "error", error_code: "game_not_active" },
    })
  })
})

describe("CustomError", () => {
  it("carries its code and cause", () => {
    const cause = new Error("root")
    const thrown = new CustomError("illegal_move", cause)

    expect(thrown).toBeInstanceOf(Error)
    expect(thrown.name).toBe("CustomError")
    expect(thrown.errorCode).toBe("illegal_move")
    expect(thrown.cause).toBe(cause)
  })

  it("leaves the cause unset when there is none", () => {
    expect("cause" in new CustomError("not_found")).toBe(false)
  })

  it("makes a RetryLaterError a CustomError with its wait", () => {
    const thrown = new RetryLaterError("rate_limit_exceeded", 30)

    expect(thrown).toBeInstanceOf(CustomError)
    expect(thrown.retryAfterSeconds).toBe(30)
  })
})

describe("ERROR_CODES", () => {
  it("gives every code a message and an error status", () => {
    for (const [message, status] of Object.values(ERROR_CODES)) {
      expect(message.length).toBeGreaterThan(0)
      expect(status).toBeGreaterThanOrEqual(400)
      expect(status).toBeLessThan(600)
    }
  })
})
