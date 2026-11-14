import { env } from "cloudflare:workers"
import { eq } from "drizzle-orm"
import { beforeAll, describe, expect, it } from "vitest"
import { user } from "@/database/auth.schema"
import { getDb } from "@/database/client"
import { inviteLinks } from "@/database/schema"
import { envRegistry } from "@/env/registry"
import { InviteLinkService } from "@/services/invite-link.service"
import { failingD1 } from "@/test-support/failing-bindings"

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

/**
 * The link's own rules, driven at the service.
 *
 * The routes test covers the http answers; this covers the states a link can be
 * in, including the ones a request cannot arrange in a test's lifetime, like a
 * link that ran out a week later.
 */
describe("invite link service", () => {
  beforeAll(() => {
    envRegistry.setEnv(env as unknown as Record<string, unknown>)
  })

  const db = getDb(env.DB)
  const links = new InviteLinkService(db)

  let seats = 0
  async function player(): Promise<{ id: string; handle: string }> {
    seats += 1
    const id = crypto.randomUUID()
    const handle = `linker${seats}`
    const now = new Date()
    await db.insert(user).values({
      id,
      name: `account ${handle}`,
      email: `${handle}@service.abalone.invalid`,
      username: handle,
      displayUsername: handle.toUpperCase(),
      createdAt: now,
      updatedAt: now,
    })
    return { id, handle }
  }

  async function expire(linkId: string) {
    await db
      .update(inviteLinks)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(inviteLinks.id, linkId))
  }

  describe("create", () => {
    it("makes an open link good for a week", async () => {
      const inviter = await player()
      const before = Date.now()

      const link = await links.create(inviter.id, "standard", "black")

      expect(link).toMatchObject({
        fromUserId: inviter.id,
        setupType: "standard",
        side: "black",
        usedAt: null,
        usedByUserId: null,
        gameId: null,
      })
      expect(link.expiresAt).toBeGreaterThanOrEqual(before + WEEK_MS)
      expect(link.expiresAt).toBeLessThanOrEqual(Date.now() + WEEK_MS)
    })

    //the id is the whole secret
    it("gives every link its own 43-character url-safe id", async () => {
      const inviter = await player()

      const first = await links.create(inviter.id, "standard", "random")
      const second = await links.create(inviter.id, "standard", "random")

      expect(first.id).toMatch(/^[A-Za-z0-9_-]{43}$/)
      expect(second.id).not.toBe(first.id)
    })

    it("fails as an internal error when D1 is down", async () => {
      const broken = new InviteLinkService(getDb(failingD1()))

      await expect(
        broken.create(crypto.randomUUID(), "standard", "black"),
      ).rejects.toMatchObject({ errorCode: "internal_server_error" })
    })
  })

  describe("readPublic", () => {
    it("names the inviter and says the link is open", async () => {
      const inviter = await player()
      const link = await links.create(inviter.id, "standard", "white")

      expect(await links.readPublic(link.id)).toEqual({
        inviterName: inviter.handle.toUpperCase(),
        state: "open",
      })
    })

    it("says a claimed link is used", async () => {
      const inviter = await player()
      const guest = await player()
      const link = await links.create(inviter.id, "standard", "black")
      await links.claim(link.id, guest.id)

      expect((await links.readPublic(link.id)).state).toBe("used")
    })

    it("says a link past its week is expired", async () => {
      const inviter = await player()
      const link = await links.create(inviter.id, "standard", "black")
      await expire(link.id)

      expect((await links.readPublic(link.id)).state).toBe("expired")
    })

    //a link that became a game stays that game's record
    it("says used, not expired, for a used link past its week", async () => {
      const inviter = await player()
      const guest = await player()
      const link = await links.create(inviter.id, "standard", "black")
      await links.claim(link.id, guest.id)
      await expire(link.id)

      expect((await links.readPublic(link.id)).state).toBe("used")
    })

    it("answers not_found for a link that does not exist", async () => {
      await expect(links.readPublic("no-such-link")).rejects.toMatchObject(
        {
          errorCode: "not_found",
        },
      )
    })

    it("fails as an internal error when D1 is down", async () => {
      const broken = new InviteLinkService(getDb(failingD1()))

      await expect(broken.readPublic("any")).rejects.toMatchObject({
        errorCode: "internal_server_error",
      })
    })
  })

  describe("claim", () => {
    it("hands an open link to the player who takes it", async () => {
      const inviter = await player()
      const guest = await player()
      const link = await links.create(inviter.id, "standard", "black")

      const claimed = await links.claim(link.id, guest.id)

      expect(claimed).toMatchObject({
        id: link.id,
        usedByUserId: guest.id,
      })
      expect(claimed?.usedAt).toEqual(expect.any(Number))
    })

    it("gives a link to only one of two players", async () => {
      const inviter = await player()
      const first = await player()
      const second = await player()
      const link = await links.create(inviter.id, "standard", "black")

      const results = await Promise.all([
        links.claim(link.id, first.id),
        links.claim(link.id, second.id),
      ])

      expect(results.filter((result) => result !== null)).toHaveLength(1)
    })

    it("does not let the inviter take their own link", async () => {
      const inviter = await player()
      const link = await links.create(inviter.id, "standard", "black")

      expect(await links.claim(link.id, inviter.id)).toBeNull()
    })

    it("does not hand out an expired link", async () => {
      const inviter = await player()
      const guest = await player()
      const link = await links.create(inviter.id, "standard", "black")
      await expire(link.id)

      expect(await links.claim(link.id, guest.id)).toBeNull()
    })

    it("claims nothing for a link that does not exist", async () => {
      const guest = await player()

      expect(await links.claim("no-such-link", guest.id)).toBeNull()
    })

    it("fails as an internal error when D1 is down", async () => {
      const broken = new InviteLinkService(getDb(failingD1()))

      await expect(broken.claim("any", "anyone")).rejects.toMatchObject({
        errorCode: "internal_server_error",
      })
    })
  })

  describe("explainUnclaimed", () => {
    it("hands the link back to the player who already used it", async () => {
      const inviter = await player()
      const guest = await player()
      const link = await links.create(inviter.id, "standard", "black")
      await links.claim(link.id, guest.id)

      const again = await links.explainUnclaimed(link.id, guest.id)

      expect(again).toMatchObject({ id: link.id, usedByUserId: guest.id })
    })

    it("answers invite_link_own to the inviter", async () => {
      const inviter = await player()
      const link = await links.create(inviter.id, "standard", "black")

      await expect(
        links.explainUnclaimed(link.id, inviter.id),
      ).rejects.toMatchObject({ errorCode: "invite_link_own" })
    })

    it("answers invite_link_used to a second player", async () => {
      const inviter = await player()
      const guest = await player()
      const late = await player()
      const link = await links.create(inviter.id, "standard", "black")
      await links.claim(link.id, guest.id)

      await expect(
        links.explainUnclaimed(link.id, late.id),
      ).rejects.toMatchObject({ errorCode: "invite_link_used" })
    })

    it("answers invite_link_expired for a link past its week", async () => {
      const inviter = await player()
      const guest = await player()
      const link = await links.create(inviter.id, "standard", "black")
      await expire(link.id)

      await expect(
        links.explainUnclaimed(link.id, guest.id),
      ).rejects.toMatchObject({ errorCode: "invite_link_expired" })
    })

    it("answers not_found for a link that does not exist", async () => {
      const guest = await player()

      await expect(
        links.explainUnclaimed("no-such-link", guest.id),
      ).rejects.toMatchObject({ errorCode: "not_found" })
    })
  })

  describe("attachGame", () => {
    it("records the game a claimed link opened", async () => {
      const inviter = await player()
      const guest = await player()
      const link = await links.create(inviter.id, "standard", "black")
      await links.claim(link.id, guest.id)
      const gameId = crypto.randomUUID()

      await links.attachGame(link.id, gameId)

      const again = await links.explainUnclaimed(link.id, guest.id)
      expect(again.gameId).toBe(gameId)
    })

    it("fails as an internal error when D1 is down", async () => {
      const broken = new InviteLinkService(getDb(failingD1()))

      await expect(broken.attachGame("any", "game")).rejects.toMatchObject(
        {
          errorCode: "internal_server_error",
        },
      )
    })
  })
})
