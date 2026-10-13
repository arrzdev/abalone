import type { SetupKey } from "@repo/abalone-engine/board-setups"
import tryCatch from "@repo/shared/try-catch"
import { and, eq, gt, isNull, ne } from "drizzle-orm"
import { user } from "@/database/auth.schema"
import type { Db } from "@/database/client"
import type { InviteSide } from "@/database/schema"
import { inviteLinks } from "@/database/schema"
import { CustomError } from "@/http/errors"
import { toBase64Url } from "@/utils/base64url"
import { playerName } from "@/utils/player-summary"

const LINK_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000

//32 bytes is the whole secret: nobody guesses a link, they are sent one
const LINK_ID_BYTES = 32

export type InviteLinkState = "open" | "used" | "expired"

/** A link as its own service sees it: the row, with dates as epoch ms. */
export type InviteLink = {
  id: string
  fromUserId: string
  setupType: SetupKey
  side: InviteSide
  expiresAt: number
  usedAt: number | null
  usedByUserId: string | null
  gameId: string | null
}

/** What anyone holding the link may learn about it, and nothing more. */
export type PublicInviteLink = {
  inviterName: string
  state: InviteLinkState
}

const LINK_COLUMNS = {
  id: inviteLinks.id,
  fromUserId: inviteLinks.fromUserId,
  setupType: inviteLinks.setupType,
  side: inviteLinks.side,
  expiresAt: inviteLinks.expiresAt,
  usedAt: inviteLinks.usedAt,
  usedByUserId: inviteLinks.usedByUserId,
  gameId: inviteLinks.gameId,
}

type InviteLinkRow = {
  id: string
  fromUserId: string
  setupType: SetupKey
  side: InviteSide
  expiresAt: Date
  usedAt: Date | null
  usedByUserId: string | null
  gameId: string | null
}

function toInviteLink(row: InviteLinkRow): InviteLink {
  return {
    ...row,
    expiresAt: row.expiresAt.getTime(),
    usedAt: row.usedAt?.getTime() ?? null,
  }
}

//used wins over expired: a link that became a game stays that game's record,
//however long ago that was
function stateOf(link: InviteLink, now: number): InviteLinkState {
  if (link.usedAt !== null) return "used"
  if (link.expiresAt <= now) return "expired"
  return "open"
}

function newLinkId(): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(LINK_ID_BYTES)))
}

//---- service ----------------

export class InviteLinkService {
  constructor(private db: Db) {}

  /** Makes a link to a game on these terms, good for a week. */
  async create(
    fromUserId: string,
    setupType: SetupKey,
    side: InviteSide,
  ): Promise<InviteLink> {
    const now = new Date()

    const [row, writeError] = await tryCatch(() =>
      this.db
        .insert(inviteLinks)
        .values({
          id: newLinkId(),
          fromUserId,
          setupType,
          side,
          expiresAt: new Date(now.getTime() + LINK_LIFETIME_MS),
          createdAt: now,
        })
        .returning(LINK_COLUMNS)
        .get(),
    )
    if (writeError)
      throw new CustomError("internal_server_error", writeError)

    return toInviteLink(row)
  }

  /** Who sent a link and whether it still stands, for anyone holding it. */
  async readPublic(linkId: string): Promise<PublicInviteLink> {
    const [row, readError] = await tryCatch(() =>
      this.db
        .select({
          ...LINK_COLUMNS,
          username: user.username,
          displayUsername: user.displayUsername,
          accountName: user.name,
        })
        .from(inviteLinks)
        .innerJoin(user, eq(user.id, inviteLinks.fromUserId))
        .where(eq(inviteLinks.id, linkId))
        .get(),
    )
    if (readError)
      throw new CustomError("internal_server_error", readError)
    if (!row) throw new CustomError("not_found")

    return {
      inviterName: playerName(row),
      state: stateOf(toInviteLink(row), Date.now()),
    }
  }

  /**
   * Takes a link for this player, if it is still there to take.
   *
   * One conditional update, so of two players racing for the same link exactly
   * one gets a row back. Null means nothing was claimed, and `explainUnclaimed`
   * says why.
   */
  async claim(linkId: string, userId: string): Promise<InviteLink | null> {
    const now = new Date()

    const [row, writeError] = await tryCatch(() =>
      this.db
        .update(inviteLinks)
        .set({ usedAt: now, usedByUserId: userId })
        .where(
          and(
            eq(inviteLinks.id, linkId),
            isNull(inviteLinks.usedAt),
            gt(inviteLinks.expiresAt, now),
            ne(inviteLinks.fromUserId, userId),
          ),
        )
        .returning(LINK_COLUMNS)
        .get(),
    )
    if (writeError)
      throw new CustomError("internal_server_error", writeError)

    return row ? toInviteLink(row) : null
  }

  /**
   * Why a claim came back empty, as the error to answer with.
   *
   * Returns the link instead when this player is the one who already used it:
   * that is a retry, and the caller carries on to the game.
   */
  async explainUnclaimed(
    linkId: string,
    userId: string,
  ): Promise<InviteLink> {
    const link = await this.find(linkId)
    if (!link) throw new CustomError("not_found")
    if (link.usedByUserId === userId) return link
    if (link.fromUserId === userId)
      throw new CustomError("invite_link_own")
    if (link.usedAt !== null) throw new CustomError("invite_link_used")
    throw new CustomError("invite_link_expired")
  }

  /** Records the game a claimed link opened. */
  async attachGame(linkId: string, gameId: string): Promise<void> {
    const [, writeError] = await tryCatch(() =>
      this.db
        .update(inviteLinks)
        .set({ gameId })
        .where(eq(inviteLinks.id, linkId)),
    )
    if (writeError)
      throw new CustomError("internal_server_error", writeError)
  }

  private async find(linkId: string): Promise<InviteLink | null> {
    const [row, readError] = await tryCatch(() =>
      this.db
        .select(LINK_COLUMNS)
        .from(inviteLinks)
        .where(eq(inviteLinks.id, linkId))
        .get(),
    )
    if (readError)
      throw new CustomError("internal_server_error", readError)

    return row ? toInviteLink(row) : null
  }
}
