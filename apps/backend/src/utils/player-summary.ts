import { avatarUrl } from "@/utils/avatar-url"

/**
 * A player as the *other* player sees them.
 *
 * The public half of an account: a handle and a face, never an email and never
 * anything the owner has not already put on show. Invites and games both hand
 * these out, which is why it is kernel rather than either one's own type.
 */
export type PlayerSummary = {
  userId: string
  /** The handle as its owner typed it, the one name a screen shows. */
  name: string
  avatarUrl: string | null
}

type PlayerNameParts = {
  username: string | null
  displayUsername: string | null
  /** The account's sign-up name, only reached when it has no handle at all. */
  accountName: string
}

type PlayerRow = PlayerNameParts & {
  userId: string
  avatarKey: string | null
}

/**
 * The one name a player goes by: the handle with the capitals they typed, the
 * stored lowercase handle when no display form exists, and the account name
 * for an account that never picked a handle.
 */
export function playerName(parts: PlayerNameParts): string {
  return parts.displayUsername ?? parts.username ?? parts.accountName
}

export function toPlayerSummary(row: PlayerRow): PlayerSummary {
  return {
    userId: row.userId,
    name: playerName(row),
    avatarUrl: avatarUrl(row.avatarKey),
  }
}
