import { env } from "cloudflare:workers"
import { beforeAll, describe, expect, it } from "vitest"
import { user } from "@/database/auth.schema"
import { getDb } from "@/database/client"
import { profiles } from "@/database/schema"
import { envRegistry } from "@/env/registry"
import { ProfileService } from "@/services/profile.service"
import { failingBucket, failingD1 } from "@/test-support/failing-bindings"

/**
 * What the profile route tests cannot reach over http: the jpeg signature, the
 * too-short inputs the sniffer must turn away, and R2 or D1 failing.
 */
describe("profile service", () => {
  beforeAll(() => {
    envRegistry.setEnv(env as unknown as Record<string, unknown>)
  })

  const db = getDb(env.DB)
  const profilesService = new ProfileService(db, env.AVATARS)

  let players = 0
  async function seededPlayer(): Promise<string> {
    players += 1
    const id = crypto.randomUUID()
    const handle = `profiled${players}`
    const now = new Date()
    await db.insert(user).values({
      id,
      name: handle,
      email: `${handle}@service.abalone.invalid`,
      username: handle,
      displayUsername: handle,
      createdAt: now,
      updatedAt: now,
    })
    await db.insert(profiles).values({
      userId: id,
      avatarKey: null,
      createdAt: now,
      updatedAt: now,
    })
    return id
  }

  function jpegBytes(): Uint8Array {
    const bytes = new Uint8Array(16)
    bytes.set([0xff, 0xd8, 0xff, 0xe0])
    return bytes
  }

  //---- reading ----------------

  it("answers not_found for a player who does not exist", async () => {
    await expect(
      profilesService.get(crypto.randomUUID()),
    ).rejects.toMatchObject({ errorCode: "not_found" })
  })

  it("answers internal_server_error when D1 refuses the read", async () => {
    const broken = new ProfileService(getDb(failingD1()), env.AVATARS)

    await expect(broken.get("anyone")).rejects.toMatchObject({
      errorCode: "internal_server_error",
    })
  })

  //---- uploading ----------------

  it("stores a jpeg under a .jpg key, whatever it was called", async () => {
    const userId = await seededPlayer()

    const profile = await profilesService.setAvatar(userId, jpegBytes())

    expect(profile.avatarUrl).toMatch(/\/avatars\/[0-9a-f]{64}\.jpg$/)
    const key = profile.avatarUrl?.split("/").slice(-2).join("/") ?? ""
    const stored = await env.AVATARS.head(key)
    expect(stored?.httpMetadata?.contentType).toBe("image/jpeg")
  })

  it("refuses bytes too short to carry any signature", async () => {
    const userId = await seededPlayer()

    await expect(
      profilesService.setAvatar(userId, new Uint8Array([0xff, 0xd8])),
    ).rejects.toMatchObject({ errorCode: "unsupported_media_type" })
  })

  it("refuses a RIFF file that is not a webp", async () => {
    const userId = await seededPlayer()
    const wave = new Uint8Array(16)
    wave.set([0x52, 0x49, 0x46, 0x46], 0)
    wave.set([0x57, 0x41, 0x56, 0x45], 8)

    await expect(
      profilesService.setAvatar(userId, wave),
    ).rejects.toMatchObject({ errorCode: "unsupported_media_type" })
  })

  it("answers internal_server_error when R2 refuses the upload", async () => {
    const userId = await seededPlayer()
    const broken = new ProfileService(db, failingBucket())

    await expect(
      broken.setAvatar(userId, jpegBytes()),
    ).rejects.toMatchObject({ errorCode: "internal_server_error" })
    expect((await profilesService.get(userId)).avatarUrl).toBeNull()
  })

  it("answers internal_server_error when D1 refuses to point at the upload", async () => {
    const broken = new ProfileService(getDb(failingD1()), env.AVATARS)

    await expect(
      broken.setAvatar("anyone", jpegBytes()),
    ).rejects.toMatchObject({ errorCode: "internal_server_error" })
  })

  //---- the dev read path ----------------

  it("streams a stored avatar back", async () => {
    await env.AVATARS.put("avatars/stored.png", new Uint8Array([1, 2, 3]))

    const object = await profilesService.readAvatar("avatars/stored.png")

    expect(new Uint8Array(await object.arrayBuffer())).toEqual(
      new Uint8Array([1, 2, 3]),
    )
  })

  it("answers not_found for a key with no object", async () => {
    await expect(
      profilesService.readAvatar("avatars/missing.png"),
    ).rejects.toMatchObject({ errorCode: "not_found" })
  })

  it("answers internal_server_error when R2 refuses the read", async () => {
    const broken = new ProfileService(db, failingBucket())

    await expect(
      broken.readAvatar("avatars/stored.png"),
    ).rejects.toMatchObject({ errorCode: "internal_server_error" })
  })
})
