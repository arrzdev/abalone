import { env } from "cloudflare:workers"
import { beforeAll, describe, expect, it } from "vitest"
import { user } from "@/database/auth.schema"
import { getDb } from "@/database/client"
import { envRegistry } from "@/env/registry"
import { InviteService } from "@/services/invite.service"
import { failingD1 } from "@/test-support/failing-bindings"

/**
 * What the invite route tests cannot reach over http: the two calls only the
 * acceptance facade makes, and D1 failing at each step of a send.
 */
describe("invite service", () => {
  beforeAll(() => {
    envRegistry.setEnv(env as unknown as Record<string, unknown>)
  })

  const db = getDb(env.DB)
  const inviteService = new InviteService(db)

  let players = 0
  async function seededPlayer(): Promise<{ id: string; handle: string }> {
    players += 1
    const id = crypto.randomUUID()
    const handle = `invited${players}`
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
    return { id, handle }
  }

  async function pendingInvite() {
    const sender = await seededPlayer()
    const recipient = await seededPlayer()
    const stranger = await seededPlayer()
    const sent = await inviteService.create(
      sender.id,
      recipient.handle,
      "standard",
      "black",
    )
    return { sender, recipient, stranger, sent }
  }

  /**
   * The real local D1, until the nth query, which it refuses.
   *
   * A send is up to four queries in a row, and `failingD1` refuses the first,
   * so only this reaches the failure branches after it.
   */
  function d1FailingAt(query: number): D1Database {
    let seen = 0
    return new Proxy(env.DB, {
      get(target, property) {
        if (property !== "prepare") return Reflect.get(target, property)
        return (sql: string) => {
          seen += 1
          if (seen >= query) throw new Error("D1 is not answering")
          return target.prepare(sql)
        }
      },
    })
  }

  //---- the acceptance facade's calls ----------------

  describe("findAddressedTo", () => {
    it("finds a pending invite for its recipient", async () => {
      const { recipient, sent } = await pendingInvite()

      const found = await inviteService.findAddressedTo(
        sent.id,
        recipient.id,
      )

      expect(found).toEqual(sent)
    })

    it("finds nothing for the sender or a stranger", async () => {
      const { sender, stranger, sent } = await pendingInvite()

      expect(
        await inviteService.findAddressedTo(sent.id, sender.id),
      ).toBeNull()
      expect(
        await inviteService.findAddressedTo(sent.id, stranger.id),
      ).toBeNull()
    })

    it("finds nothing once the invite is declined", async () => {
      const { recipient, sent } = await pendingInvite()
      await inviteService.decline(sent.id, recipient.id)

      expect(
        await inviteService.findAddressedTo(sent.id, recipient.id),
      ).toBeNull()
    })
  })

  describe("discard", () => {
    it("deletes the invite for both sides", async () => {
      const { sender, recipient, sent } = await pendingInvite()

      await inviteService.discard(sent.id)

      expect(await inviteService.listForUser(sender.id)).toEqual([])
      expect(await inviteService.listForUser(recipient.id)).toEqual([])
    })
  })

  //---- D1 failing ----------------

  describe("when D1 refuses", () => {
    const broken = new InviteService(getDb(failingD1()))

    it.each([
      ["a list", () => broken.listForUser("anyone")],
      ["a decline", () => broken.decline(crypto.randomUUID(), "anyone")],
      ["a delete", () => broken.removeOwn(crypto.randomUUID(), "anyone")],
      [
        "an acceptance lookup",
        () => broken.findAddressedTo(crypto.randomUUID(), "anyone"),
      ],
      [
        "the player lookup",
        () => broken.create("a", "b", "standard", "black"),
      ],
    ])("answers internal_server_error on %s", async (_, act) => {
      await expect(act()).rejects.toMatchObject({
        errorCode: "internal_server_error",
      })
    })

    it("answers internal_server_error when the existing invite read fails", async () => {
      const sender = await seededPlayer()
      const recipient = await seededPlayer()
      const flaky = new InviteService(getDb(d1FailingAt(2)))

      await expect(
        flaky.create(sender.id, recipient.handle, "standard", "black"),
      ).rejects.toMatchObject({ errorCode: "internal_server_error" })
    })

    //the pair index refusing a racing second send lands here too, which is
    //why a failed write reads as the invite already being out
    it("answers invite_exists when the write fails", async () => {
      const sender = await seededPlayer()
      const recipient = await seededPlayer()
      const flaky = new InviteService(getDb(d1FailingAt(3)))

      await expect(
        flaky.create(sender.id, recipient.handle, "standard", "black"),
      ).rejects.toMatchObject({ errorCode: "invite_exists" })
    })

    it("answers internal_server_error when reading the sent invite back fails", async () => {
      const sender = await seededPlayer()
      const recipient = await seededPlayer()
      const flaky = new InviteService(getDb(d1FailingAt(4)))

      await expect(
        flaky.create(sender.id, recipient.handle, "standard", "black"),
      ).rejects.toMatchObject({ errorCode: "internal_server_error" })
    })

    it("answers internal_server_error when reading a declined invite back fails", async () => {
      const { recipient, sent } = await pendingInvite()
      const flaky = new InviteService(getDb(d1FailingAt(2)))

      await expect(
        flaky.decline(sent.id, recipient.id),
      ).rejects.toMatchObject({ errorCode: "internal_server_error" })
    })
  })
})
