import { Hono } from "hono"
import { describe, expect, it } from "vitest"
import { buildShaPlugin, versionRoute } from "@/http/plugins/build-sha"

const sha = "0123456789abcdef0123456789abcdef01234567"

function app() {
  const server = new Hono<{ Bindings: { BUILD_SHA?: string } }>()
  server.use("*", buildShaPlugin())
  server.route("/version", versionRoute)
  server.get("/", (c) => c.json({ ok: true }))
  server.get("/boom", () => {
    throw new Error("boom")
  })
  //a fetch() response has immutable headers (Response.redirect does too)
  server.get("/proxied", () =>
    Response.redirect("https://example.com/", 302),
  )
  server.onError((_error, c) => c.json({ error: true }, 500))
  return server
}

describe("build sha", () => {
  it("serves the deployed BUILD_SHA at /version", async () => {
    const response = await app().request(
      "/version",
      {},
      { BUILD_SHA: sha },
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ sha })
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(response.headers.get("x-build-sha")).toBe(sha)
  })

  it("puts x-build-sha on every response, errors included", async () => {
    const ok = await app().request("/", {}, { BUILD_SHA: sha })
    const failed = await app().request("/boom", {}, { BUILD_SHA: sha })

    expect(ok.headers.get("x-build-sha")).toBe(sha)
    expect(failed.status).toBe(500)
    expect(failed.headers.get("x-build-sha")).toBe(sha)
  })

  it("keeps the status of a response with immutable headers", async () => {
    const response = await app().request(
      "/proxied",
      {},
      { BUILD_SHA: sha },
    )

    expect(response.status).toBe(302)
    expect(response.headers.get("x-build-sha")).toBe(sha)
  })

  it("answers null and sets no header without BUILD_SHA (local dev)", async () => {
    const response = await app().request("/version", {}, {})

    expect(await response.json()).toEqual({ sha: null })
    expect(response.headers.get("x-build-sha")).toBeNull()
  })

  it("leaves a websocket upgrade untouched", async () => {
    const response = await app().request(
      "/",
      { headers: { upgrade: "websocket" } },
      { BUILD_SHA: sha },
    )

    expect(response.headers.get("x-build-sha")).toBeNull()
  })
})
