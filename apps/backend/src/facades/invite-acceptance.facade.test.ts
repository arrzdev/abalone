import { env } from "cloudflare:workers"
import { eq } from "drizzle-orm"
import { beforeAll, describe, expect, it } from "vitest"
import { user } from "@/database/auth.schema"
import { getDb } from "@/database/client"
import type { InviteStatus } from "@/database/schema"
import { games, invites } from "@/database/schema"
import { envRegistry } from "@/env/registry"
import { InviteAcceptanceFacade } from "@/facades/invite-acceptance.facade"
import { GameService } from "@/services/game.service"
import { InviteService } from "@/services/invite.service"

/**
 * Accepting an invite, driven at the facade with the real services under it.
 *
 * What it owns is the order: who may answer is decided before anything is
 * written, the game is opened before the invite goes, and a retry after a
 * half-finished accept finds the game rather than opening a second one.
 */
describe("invite acceptance facade", () => {
  beforeAll(() => {
    envRegistry.setEnv(env as unknown as Record<string, unknown>)
  })

  const db = getDb(env.DB)
  const inviteService = new InviteService(db)
  const gameService = new GameService(db)
  const facade = new InviteAcceptanceFacade(inviteService, gameService)

  let seats = 0
  async function player(): Promise<string> {
    seats += 1
    const id = crypto.randomUUID()
    const handle = `accepter${seats}`
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
    return id
  }

  async function invite(
    fromUserId: string,
    toUserId: string,
    status: InviteStatus = "pending",
  ): Promise<string> {
    const id = crypto.randomUUID()
    const now = new Date()
    await db.insert(invites).values({
      id,
      fromUserId,
      toUserId,
      setupType: "standard",
      side: "black",
      status,
      createdAt: now,
      updatedAt: now,
    })
    return id
  }

  async function gamesFor(inviteId: string) {
    return db
      .select({ id: games.id })
      .from(games)
      .where(eq(games.inviteId, inviteId))
  }

  it("opens the game on the invite's terms and removes the invite", async () => {
    const inviter = await player()
    const invitee = await player()
    const inviteId = await invite(inviter, invitee)

    const game = await facade.accept(inviteId, invitee)

    expect(game).toMatchObject({
      status: "active",
      setupType: "standard",
      currentTurn: "black",
      moveCount: 0,
      black: { userId: inviter },
      white: { userId: invitee },
    })
    expect(
      await inviteService.findAddressedTo(inviteId, invitee),
    ).toBeNull()
    expect(await gamesFor(inviteId)).toEqual([{ id: game.id }])
  })

  //a game that was opened but whose invite was never cleared, the state a
  //failure between the two writes leaves behind
  it("finds the game a half-finished accept already opened", async () => {
    const inviter = await player()
    const invitee = await player()
    const inviteId = await invite(inviter, invitee)
    const openedBefore = await gameService.open({
      inviteId,
      fromUserId: inviter,
      toUserId: invitee,
      side: "black",
      setupType: "standard",
    })

    const game = await facade.accept(inviteId, invitee)

    expect(game.id).toBe(openedBefore)
    expect(await gamesFor(inviteId)).toHaveLength(1)
    expect(
      await inviteService.findAddressedTo(inviteId, invitee),
    ).toBeNull()
  })

  it("does not let the sender accept their own invite", async () => {
    const inviter = await player()
    const invitee = await player()
    const inviteId = await invite(inviter, invitee)

    await expect(facade.accept(inviteId, inviter)).rejects.toMatchObject({
      errorCode: "not_found",
    })
    expect(await gamesFor(inviteId)).toHaveLength(0)
  })

  it("answers a stranger as if the invite did not exist", async () => {
    const inviter = await player()
    const invitee = await player()
    const stranger = await player()
    const inviteId = await invite(inviter, invitee)

    await expect(facade.accept(inviteId, stranger)).rejects.toMatchObject({
      errorCode: "not_found",
    })
    expect(await gamesFor(inviteId)).toHaveLength(0)
    //and it is still there for the player it was meant for
    expect(
      await inviteService.findAddressedTo(inviteId, invitee),
    ).not.toBeNull()
  })

  it("does not accept an invite that was already declined", async () => {
    const inviter = await player()
    const invitee = await player()
    const inviteId = await invite(inviter, invitee, "declined")

    await expect(facade.accept(inviteId, invitee)).rejects.toMatchObject({
      errorCode: "not_found",
    })
    expect(await gamesFor(inviteId)).toHaveLength(0)
  })

  it("does not accept an invite twice", async () => {
    const inviter = await player()
    const invitee = await player()
    const inviteId = await invite(inviter, invitee)
    await facade.accept(inviteId, invitee)

    await expect(facade.accept(inviteId, invitee)).rejects.toMatchObject({
      errorCode: "not_found",
    })
    expect(await gamesFor(inviteId)).toHaveLength(1)
  })

  it("answers not_found for an invite that does not exist", async () => {
    const invitee = await player()

    await expect(
      facade.accept(crypto.randomUUID(), invitee),
    ).rejects.toMatchObject({ errorCode: "not_found" })
  })
})
