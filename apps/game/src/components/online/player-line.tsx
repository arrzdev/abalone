import { Avatar } from "@/components/ui/avatar"

/** Whoever the row is about, as the api describes them. */
export type PlayerLinePlayer = {
  username: string | null
  displayUsername: string | null
  avatarUrl: string | null
}

export type PlayerLineProps = {
  player: PlayerLinePlayer
  /** The line under the name: whose turn it is, how it ended, what was asked. */
  detail: string
}

/**
 * A face, a name, and one line about them.
 *
 * Every row on this screen is somebody plus a fact, so they all open the same
 * way. The name comes from `displayUsername` because that is the casing the
 * player typed; the normalised one is only what a lookup matches on.
 */
export function PlayerLine({ player, detail }: PlayerLineProps) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <Avatar src={player.avatarUrl} size={40} />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-white">
          {player.displayUsername ?? player.username}
        </p>
        <p className="mt-0.5 truncate text-xs text-white/45">{detail}</p>
      </div>
    </div>
  )
}
