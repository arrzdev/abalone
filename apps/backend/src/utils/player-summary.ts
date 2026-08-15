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
  username: string | null
  displayUsername: string | null
  avatarUrl: string | null
}

type PlayerRow = {
  userId: string
  username: string | null
  displayUsername: string | null
  avatarKey: string | null
}

export function toPlayerSummary(row: PlayerRow): PlayerSummary {
  return {
    userId: row.userId,
    username: row.username,
    displayUsername: row.displayUsername,
    avatarUrl: avatarUrl(row.avatarKey),
  }
}
