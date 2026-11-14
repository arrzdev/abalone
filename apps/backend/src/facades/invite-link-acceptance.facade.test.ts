import { env } from "cloudflare:workers"
import { eq } from "drizzle-orm"
import { beforeAll, describe, expect, it } from "vitest"
import { user } from "@/database/auth.schema"
import { getDb } from "@/database/client"
import { games, inviteLinks } from "@/database/schema"
import { envRegistry } from "@/env/registry"
import { InviteLinkAcceptanceFacade } from "@/facades/invite-link-acceptance.facade"
import { GameService } from "@/services/game.service"
import { InviteLinkService } from "@/services/invite-link.service"

/**
 * Accepting an invite link, driven at the facade with the real services.
 *
 * The claim decides; the game write after it is idempotent. So what is under
 * test is that a refused claim writes nothing, and that the same player asking
 * again, whether after a full accept or a half-finished one, lands in one game.
 */
describe("invite link acceptance facade", () => {
  beforeAll(() => {
    envRegistry.setEnv(env as unknown as Record<string, unknown>)
  })

  const db = getDb(env.DB)
  const linkService = new InviteLinkService(db)
  const gameService = new GameService(db)
  const facade = new InviteLinkAcceptanceFacade(linkService, gameService)

  let seats = 0
  async function player(): Promise<string> {
    seats += 1
    const id = crypto.randomUUID()
    const handle = `linkguest${seats}`
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

  async function gamesFor(linkId: string) {
    return db
      .select({ id: games.id })
      .from(games)
      .where(eq(games.inviteId, linkId))
  }

  it("opens a game for the player who takes the link", async () => {
    const inviter = await player()
    const guest = await player()
    const link = await linkService.create(inviter, "standard", "white")

    const accepted = await facade.accept(link.id, guest)

    expect(accepted).toEqual({
      gameId: expect.any(String),
      opened: true,
      playerIds: [inviter, guest],
    })
    const game = await gameService.get(accepted.gameId, guest)
    expect(game).toMatchObject({
      black: { userId: guest },
      white: { userId: inviter },
    })
    const again = await linkService.explainUnclaimed(link.id, guest)
    expect(again.gameId).toBe(accepted.gameId)
  })

  it("hands the same game back when the player asks again", async () => {
    const inviter = await player()
    const guest = await player()
    const link = await linkService.create(inviter, "standard", "black")
    const first = await facade.accept(link.id, guest)

    const second = await facade.accept(link.id, guest)

    expect(second).toEqual({
      gameId: first.gameId,
      opened: false,
      playerIds: [inviter, guest],
    })
    expect(await gamesFor(link.id)).toHaveLength(1)
  })

  //a claimed link with no game, the state a failure between the two writes
  //leaves behind
  it("opens the game for a link this player claimed but never got a game from", async () => {
    const inviter = await player()
    const guest = await player()
    const link = await linkService.create(inviter, "standard", "black")
    await linkService.claim(link.id, guest)

    const accepted = await facade.accept(link.id, guest)

    expect(accepted.opened).toBe(false)
    expect(await gamesFor(link.id)).toEqual([{ id: accepted.gameId }])
  })

  it("refuses the inviter and opens nothing", async () => {
    const inviter = await player()
    const link = await linkService.create(inviter, "standard", "black")

    await expect(facade.accept(link.id, inviter)).rejects.toMatchObject({
      errorCode: "invite_link_own",
    })
    expect(await gamesFor(link.id)).toHaveLength(0)
  })

  it("refuses a second player once the link is used", async () => {
    const inviter = await player()
    const guest = await player()
    const late = await player()
    const link = await linkService.create(inviter, "standard", "black")
    await facade.accept(link.id, guest)

    await expect(facade.accept(link.id, late)).rejects.toMatchObject({
      errorCode: "invite_link_used",
    })
    expect(await gamesFor(link.id)).toHaveLength(1)
  })

  it("refuses an expired link and opens nothing", async () => {
    const inviter = await player()
    const guest = await player()
    const link = await linkService.create(inviter, "standard", "black")
    await db
      .update(inviteLinks)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(inviteLinks.id, link.id))

    await expect(facade.accept(link.id, guest)).rejects.toMatchObject({
      errorCode: "invite_link_expired",
    })
    expect(await gamesFor(link.id)).toHaveLength(0)
  })

  it("answers not_found for a link that does not exist", async () => {
    const guest = await player()

    await expect(
      facade.accept("no-such-link", guest),
    ).rejects.toMatchObject({ errorCode: "not_found" })
  })
})
