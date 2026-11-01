import { env } from "cloudflare:workers"
import { afterAll, describe, expect, it } from "vitest"
import worker from "@/entrypoint"
import { envRegistry } from "@/env/registry"
import { newExecutionContext } from "@/test-support/execution-context"

//a frontend on localhost is what turns the dev passthrough on. the profile route
//tests cover the other side: with public origins it answers 404.
const DEV_FRONTEND = "http://localhost:7171"

function fetchAvatar(path: string, frontendUrls = DEV_FRONTEND) {
  return worker.fetch(
    new Request(`http://localhost:8787/api/v1/avatars/${path}`, {
      headers: { "x-test-bypass": "true" },
    }),
    { ...env, FRONTEND_URLS: frontendUrls } as never,
    newExecutionContext(),
  )
}

describe("dev avatar route", () => {
  //the entrypoint writes every request's bindings into the registry, so put
  //the suite's own back for whatever runs after this file
  afterAll(() => {
    envRegistry.setEnv(env as unknown as Record<string, unknown>)
  })

  it("serves an avatar with the headers stored on the object", async () => {
    await env.AVATARS.put(
      "avatars/served.webp",
      new Uint8Array([7, 8, 9]),
      {
        httpMetadata: {
          contentType: "image/webp",
          cacheControl: "public, max-age=31536000, immutable",
        },
      },
    )

    const response = await fetchAvatar("served.webp")

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe("image/webp")
    expect(response.headers.get("cache-control")).toBe(
      "public, max-age=31536000, immutable",
    )
    expect(response.headers.get("etag")).toMatch(/^".+"$/)
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(
      new Uint8Array([7, 8, 9]),
    )
  })

  it("falls back to safe headers for an object stored without any", async () => {
    await env.AVATARS.put("avatars/bare.bin", new Uint8Array([1]))

    const response = await fetchAvatar("bare.bin")

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe(
      "application/octet-stream",
    )
    expect(response.headers.get("cache-control")).toBe("no-store")
    await response.arrayBuffer()
  })

  it("keeps the slashes in a nested key", async () => {
    await env.AVATARS.put("avatars/nested/deep.png", new Uint8Array([4]))

    const response = await fetchAvatar("nested/deep.png")

    expect(response.status).toBe(200)
    await response.arrayBuffer()
  })

  it("answers not_found for a key with no object", async () => {
    const response = await fetchAvatar("missing.webp")

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({
      status: "error",
      error_code: "not_found",
    })
  })

  it("stays hidden when one configured frontend is public", async () => {
    await env.AVATARS.put("avatars/mixed.webp", new Uint8Array([5]))

    const response = await fetchAvatar(
      "mixed.webp",
      `${DEV_FRONTEND},https://abalone.example.com`,
    )

    expect(response.status).toBe(404)
  })
})
