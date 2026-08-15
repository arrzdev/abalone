import type { SetupKey } from "@repo/abalone-engine/board-setups"
import tryCatch from "@repo/shared/try-catch"
import { and, eq, or } from "drizzle-orm"
import { alias } from "drizzle-orm/sqlite-core"
import { user } from "@/database/auth.schema"
import type { Db } from "@/database/client"
import type { InviteSide, InviteStatus } from "@/database/schema"
import { invites, profiles } from "@/database/schema"
import { CustomError } from "@/http/errors"
import type { PlayerSummary } from "@/utils/player-summary"
import { toPlayerSummary } from "@/utils/player-summary"

/** An invite as either side of it sees it. */
export type Invite = {
  id: string
  from: PlayerSummary
  to: PlayerSummary
  setupType: SetupKey
  side: InviteSide
  status: InviteStatus
  createdAt: number
}

//both parties come out of the same two tables, so each needs its own alias
const sender = alias(user, "sender")
const senderProfile = alias(profiles, "sender_profile")
const recipient = alias(user, "recipient")
const recipientProfile = alias(profiles, "recipient_profile")

const INVITE_COLUMNS = {
  id: invites.id,
  setupType: invites.setupType,
  side: invites.side,
  status: invites.status,
  createdAt: invites.createdAt,
  fromUserId: sender.id,
  fromUsername: sender.username,
  fromDisplayUsername: sender.displayUsername,
  fromAvatarKey: senderProfile.avatarKey,
  toUserId: recipient.id,
  toUsername: recipient.username,
  toDisplayUsername: recipient.displayUsername,
  toAvatarKey: recipientProfile.avatarKey,
}

type InviteRow = {
  id: string
  setupType: SetupKey
  side: InviteSide
  status: InviteStatus
  createdAt: Date
  fromUserId: string
  fromUsername: string | null
  fromDisplayUsername: string | null
  fromAvatarKey: string | null
  toUserId: string
  toUsername: string | null
  toDisplayUsername: string | null
  toAvatarKey: string | null
}

function toInvite(row: InviteRow): Invite {
  return {
    id: row.id,
    setupType: row.setupType,
    side: row.side,
    status: row.status,
    //epoch ms, never a Date: what crosses the wire is json, and a client that
    //has to parse a date string is a client that can get the timezone wrong
    createdAt: row.createdAt.getTime(),
    from: toPlayerSummary({
      userId: row.fromUserId,
      username: row.fromUsername,
      displayUsername: row.fromDisplayUsername,
      avatarKey: row.fromAvatarKey,
    }),
    to: toPlayerSummary({
      userId: row.toUserId,
      username: row.toUsername,
      displayUsername: row.toDisplayUsername,
      avatarKey: row.toAvatarKey,
    }),
  }
}

//---- service ----------------

export class InviteService {
  constructor(private db: Db) {}

  /** Every invite a player is party to, sent or received. */
  async listForUser(userId: string): Promise<Invite[]> {
    const [rows, readError] = await tryCatch(() =>
      this.selectInvites()
        .where(
          or(eq(invites.fromUserId, userId), eq(invites.toUserId, userId)),
        )
        .orderBy(invites.createdAt),
    )
    if (readError)
      throw new CustomError("internal_server_error", readError)

    return rows.map(toInvite)
  }

  /**
   * Sends an invite, addressed by the handle the sender typed.
   *
   * A decline is not a wall: an invite that was turned down is written over
   * rather than refused, so the pair index still holds one row per direction and
   * asking again after a no does not need the sender to tidy up first.
   */
  async create(
    fromUserId: string,
    username: string,
    setupType: SetupKey,
    side: InviteSide,
  ): Promise<Invite> {
    const [target, lookupError] = await tryCatch(() =>
      this.db
        .select({ id: user.id })
        .from(user)
        //the normalised column, which is what the username plugin matches
        //sign-in on. the display casing is never what a lookup is keyed by.
        .where(eq(user.username, username.trim().toLowerCase()))
        .get(),
    )
    if (lookupError)
      throw new CustomError("internal_server_error", lookupError)
    if (!target) throw new CustomError("player_not_found")
    if (target.id === fromUserId) throw new CustomError("invite_self")

    const [existing, existingError] = await tryCatch(() =>
      this.db
        .select({ id: invites.id, status: invites.status })
        .from(invites)
        .where(
          and(
            eq(invites.fromUserId, fromUserId),
            eq(invites.toUserId, target.id),
          ),
        )
        .get(),
    )
    if (existingError)
      throw new CustomError("internal_server_error", existingError)
    if (existing?.status === "pending")
      throw new CustomError("invite_exists")

    const now = new Date()
    const values = {
      setupType,
      side,
      status: "pending" as const,
      updatedAt: now,
    }

    const [written, writeError] = await tryCatch(() =>
      existing
        ? this.db
            .update(invites)
            .set(values)
            .where(eq(invites.id, existing.id))
            .returning({ id: invites.id })
            .get()
        : this.db
            .insert(invites)
            .values({
              ...values,
              id: crypto.randomUUID(),
              fromUserId,
              toUserId: target.id,
              createdAt: now,
            })
            .returning({ id: invites.id })
            .get(),
    )
    //the pair index is the real guard: two sends racing each other both read no
    //row above, and the loser lands here rather than opening a second invite
    if (writeError) throw new CustomError("invite_exists", writeError)

    return this.getById(written.id)
  }

  /** Marks an invite declined, for the player it was addressed to. */
  async decline(inviteId: string, userId: string): Promise<Invite> {
    const [declined, writeError] = await tryCatch(() =>
      this.db
        .update(invites)
        .set({ status: "declined", updatedAt: new Date() })
        .where(this.addressedTo(inviteId, userId))
        .returning({ id: invites.id })
        .get(),
    )
    if (writeError)
      throw new CustomError("internal_server_error", writeError)
    //no row means it is not theirs to decline, or was never pending. the same
    //answer either way: nothing here for you.
    if (!declined) throw new CustomError("not_found")

    return this.getById(declined.id)
  }

  /**
   * Deletes an invite the caller sent.
   *
   * One request for two things a sender does: taking an invite back before it is
   * answered, and clearing a decline once they have read it. Both are the same
   * row leaving, so both are the same delete.
   */
  async removeOwn(inviteId: string, userId: string): Promise<void> {
    const [removed, deleteError] = await tryCatch(() =>
      this.db
        .delete(invites)
        .where(
          and(eq(invites.id, inviteId), eq(invites.fromUserId, userId)),
        )
        .returning({ id: invites.id })
        .get(),
    )
    if (deleteError)
      throw new CustomError("internal_server_error", deleteError)
    if (!removed) throw new CustomError("not_found")
  }

  /**
   * Deletes an invite by id, unconditionally.
   *
   * For the caller that has already established the right to it. It takes no
   * result, so it is safe inside a batched transaction, which is where
   * accepting one puts it.
   */
  async discard(inviteId: string): Promise<void> {
    await this.db.delete(invites).where(eq(invites.id, inviteId))
  }

  /** Finds a pending invite, for the player it was addressed to. */
  async findAddressedTo(
    inviteId: string,
    userId: string,
  ): Promise<Invite | null> {
    const [row, readError] = await tryCatch(() =>
      this.selectInvites().where(this.addressedTo(inviteId, userId)).get(),
    )
    if (readError)
      throw new CustomError("internal_server_error", readError)

    return row ? toInvite(row) : null
  }

  private async getById(inviteId: string): Promise<Invite> {
    const [row, readError] = await tryCatch(() =>
      this.selectInvites().where(eq(invites.id, inviteId)).get(),
    )
    if (readError)
      throw new CustomError("internal_server_error", readError)
    if (!row) throw new CustomError("not_found")

    return toInvite(row)
  }

  //an invite is only ever answerable by its recipient, and only while it still
  //stands. every read and write on the receiving side goes through this.
  private addressedTo(inviteId: string, userId: string) {
    return and(
      eq(invites.id, inviteId),
      eq(invites.toUserId, userId),
      eq(invites.status, "pending"),
    )
  }

  private selectInvites() {
    return this.db
      .select(INVITE_COLUMNS)
      .from(invites)
      .innerJoin(sender, eq(sender.id, invites.fromUserId))
      .leftJoin(senderProfile, eq(senderProfile.userId, sender.id))
      .innerJoin(recipient, eq(recipient.id, invites.toUserId))
      .leftJoin(
        recipientProfile,
        eq(recipientProfile.userId, recipient.id),
      )
  }
}
