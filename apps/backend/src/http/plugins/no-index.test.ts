import { Hono } from "hono"
import { describe, expect, it } from "vitest"
import { noIndexPlugin } from "@/http/plugins/no-index"

function app() {
  const server = new Hono()
  server.use("*", noIndexPlugin())
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

describe("no index", () => {
  it("marks every response noindex, errors and not-found included", async () => {
    for (const path of ["/", "/boom", "/missing"]) {
      const response = await app().request(path)

      expect(response.headers.get("x-robots-tag"), path).toBe("noindex")
    }
  })

  it("keeps the status of a response with immutable headers", async () => {
    const response = await app().request("/proxied")

    expect(response.status).toBe(302)
    expect(response.headers.get("x-robots-tag")).toBe("noindex")
  })
})
