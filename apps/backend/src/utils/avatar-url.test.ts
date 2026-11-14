import { env } from "cloudflare:workers"
import { beforeAll, describe, expect, it } from "vitest"
import { envRegistry } from "@/env/registry"
import { avatarUrl } from "@/utils/avatar-url"

//AVATAR_PUBLIC_URL is https://cdn.example.com in vitest.config.ts
describe("avatarUrl", () => {
  beforeAll(() => {
    envRegistry.setEnv(env as unknown as Record<string, unknown>)
  })

  it("hands back the public url for a stored key", () => {
    expect(avatarUrl("avatars/user-1/abc.webp")).toBe(
      "https://cdn.example.com/avatars/user-1/abc.webp",
    )
  })

  it("hands back null for a player who never uploaded one", () => {
    expect(avatarUrl(null)).toBeNull()
  })

  it("hands back null for an empty key rather than the bare host", () => {
    expect(avatarUrl("")).toBeNull()
  })
})
