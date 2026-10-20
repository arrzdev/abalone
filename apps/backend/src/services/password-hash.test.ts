import { randomBytes, scryptSync } from "node:crypto"
import { hashPassword, verifyPassword } from "better-auth/crypto"
import { describe, expect, it } from "vitest"

/**
 * Stored passwords outlive the hashing code.
 *
 * Until better-auth picked native scrypt on workerd by itself, this backend
 * hashed with its own node:crypto scrypt. Every account made before the switch
 * holds such a hash, so better-auth's default must read them, and the format
 * must not drift either way. Runs in workerd, the runtime that signs players in.
 */

const PASSWORD = "correct horse battery staple"

//made by the removed custom hash (N=16384, r=16, p=1, 64-byte key, `salt:key`)
const LEGACY_HASH =
  "5f1c2e9a0b7d4c3e8a6f1b2d3c4e5f60:ad2d015835ec466e64bd0dba4911cb12128bf43453cb8e73050ab29c2c3628b6d580d17c7afe46899ffde62ff465afbee000e891f8d1e641516a02fd8b7bc214"

//the removed custom hash, kept here only to prove both directions
function legacyHash(password: string): string {
  const salt = randomBytes(16).toString("hex")
  const key = scryptSync(password.normalize("NFKC"), salt, 64, {
    N: 16384,
    r: 16,
    p: 1,
    maxmem: 128 * 16384 * 16 * 2,
  })
  return `${salt}:${key.toString("hex")}`
}

describe("password hashing", () => {
  it("verifies a hash stored by the old custom function", async () => {
    await expect(
      verifyPassword({ hash: LEGACY_HASH, password: PASSWORD }),
    ).resolves.toBe(true)
    await expect(
      verifyPassword({ hash: LEGACY_HASH, password: "wrong password" }),
    ).resolves.toBe(false)
  })

  it("verifies a fresh hash made the old way", async () => {
    const hash = legacyHash(PASSWORD)
    await expect(
      verifyPassword({ hash, password: PASSWORD }),
    ).resolves.toBe(true)
  })

  it("writes hashes in the same salt:key format", async () => {
    const hash = await hashPassword(PASSWORD)
    expect(hash).toMatch(/^[0-9a-f]{32}:[0-9a-f]{128}$/)
    await expect(
      verifyPassword({ hash, password: PASSWORD }),
    ).resolves.toBe(true)
  })
})
