import { describe, expect, it } from "vitest"
import { envSchema } from "@/env/schema"

describe("envSchema", () => {
  it("accepts an empty environment: every key is optional", () => {
    expect(envSchema.safeParse({}).success).toBe(true)
  })

  it("accepts the keys a build is given", () => {
    const parsed = envSchema.safeParse({
      VITE_BACKEND_URL: "http://localhost:8181",
      VITE_CF_WEB_ANALYTICS_TOKEN: "token",
    })

    expect(parsed.success).toBe(true)
  })

  it("rejects a backend url that is not a url", () => {
    expect(
      envSchema.safeParse({ VITE_BACKEND_URL: "localhost" }).success,
    ).toBe(false)
    expect(envSchema.safeParse({ VITE_BACKEND_URL: "" }).success).toBe(
      false,
    )
  })

  //unset or empty turns the beacon off, so empty has to be allowed
  it("allows an empty analytics token", () => {
    expect(
      envSchema.safeParse({ VITE_CF_WEB_ANALYTICS_TOKEN: "" }).success,
    ).toBe(true)
  })

  //everything here is baked into the bundle, so nothing can be a secret
  it("only declares browser keys", () => {
    for (const key of Object.keys(envSchema.shape)) {
      expect(key.startsWith("VITE_"), key).toBe(true)
    }
  })
})
