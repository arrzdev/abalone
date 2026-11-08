import { describe, expect, it } from "vitest"
import { CLIENT_ENV_KEYS, env } from "@/env/registry"
import { envSchema } from "@/env/schema"

describe("env registry", () => {
  //the browser hydrates from the key list, check:env from the schema: a key in
  //one and not the other is either never read or never checked
  it("hydrates exactly the keys the schema declares", () => {
    expect([...CLIENT_ENV_KEYS].sort()).toEqual(
      Object.keys(envSchema.shape).sort(),
    )
  })

  it("reads a declared key from import.meta.env", () => {
    expect(env.VITE_BACKEND_URL).toBe("http://localhost:8181")
  })
})
