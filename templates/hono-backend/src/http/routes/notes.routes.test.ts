import { env } from "cloudflare:workers"
import { beforeAll, beforeEach, describe, expect, it } from "vitest"
import worker from "@/entrypoint"
import { envRegistry } from "@/env/registry"
import { resetRateLimitBuckets } from "@/http/middlewares/rate-limit"
import type { Note } from "@/services/notes.service"
import { newExecutionContext } from "@/test-support/execution-context"

type Envelope<Data> = {
  status: string
  error_code?: string
  data?: Data
}

const CLIENT_IP = "203.0.113.40"

describe("notes routes", () => {
  beforeAll(() => {
    envRegistry.setEnv(env as unknown as Record<string, unknown>)
  })

  beforeEach(async () => {
    resetRateLimitBuckets()
    await env.DB.prepare("delete from notes").run()
  })

  //---- talking to the worker ----------------

  async function call<Data>(
    path: string,
    init: { method?: string; body?: unknown } = {},
  ) {
    const response = await worker.fetch(
      new Request(`http://example.com${path}`, {
        method: init.method ?? "GET",
        headers: {
          origin: "http://example.com",
          "content-type": "application/json",
          "cf-connecting-ip": CLIENT_IP,
        },
        body:
          init.body === undefined ? undefined : JSON.stringify(init.body),
      }),
      env as never,
      newExecutionContext(),
    )
    return {
      response,
      body: (await response.json()) as Envelope<Data>,
    }
  }

  function create(body: unknown) {
    return call<{ note: Note }>("/api/v1/notes", { method: "POST", body })
  }

  //---- create ----------------

  it("creates a note and answers 201 with it", async () => {
    const { response, body } = await create({ body: "first note" })

    expect(response.status).toBe(201)
    expect(body.status).toBe("success")
    expect(body.data?.note).toMatchObject({ body: "first note" })
    expect(typeof body.data?.note.id).toBe("string")
    expect(typeof body.data?.note.createdAt).toBe("number")
  })

  it("refuses an invalid body with invalid_input", async () => {
    for (const invalid of [
      {},
      { body: "" },
      { body: 42 },
      { body: "x".repeat(2_001) },
    ]) {
      const { response, body } = await create(invalid)
      expect(response.status).toBe(400)
      expect(body).toEqual({
        status: "error",
        error_code: "invalid_input",
      })
    }

    const { body } = await call<{ notes: Note[] }>("/api/v1/notes")
    expect(body.data?.notes).toEqual([])
  })

  //---- list ----------------

  it("lists every note", async () => {
    await create({ body: "one" })
    await create({ body: "two" })

    const { response, body } = await call<{ notes: Note[] }>(
      "/api/v1/notes",
    )

    expect(response.status).toBe(200)
    expect(body.data?.notes.map((note) => note.body).sort()).toEqual([
      "one",
      "two",
    ])
  })

  //---- get ----------------

  it("gets one note by id", async () => {
    const created = await create({ body: "find me" })
    const id = created.body.data?.note.id

    const { response, body } = await call<{ note: Note }>(
      `/api/v1/notes/${id}`,
    )

    expect(response.status).toBe(200)
    expect(body.data?.note).toEqual(created.body.data?.note)
  })

  it("answers a missing note with not_found", async () => {
    const { response, body } = await call("/api/v1/notes/does-not-exist")

    expect(response.status).toBe(404)
    expect(body).toEqual({ status: "error", error_code: "not_found" })
  })

  //---- fallback ----------------

  it("answers an unknown path with the endpoint_not_found envelope", async () => {
    const { response, body } = await call("/api/v1/nothing-here")

    expect(response.status).toBe(404)
    expect(body).toEqual({
      status: "error",
      error_code: "endpoint_not_found",
    })
  })
})
