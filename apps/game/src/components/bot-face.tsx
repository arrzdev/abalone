import { cn } from "@repo/nativ/utils"
import { getBot } from "@/i18n/bots"

const FACE_BASE = `${import.meta.env.BASE_URL}images/faces`

export type BotFaceProps = {
  /** The ladder position whose character to draw. */
  level: number
  /** Square side, in px. Default 28 — the size the poster's row uses. */
  size?: number
  className?: string
}

/**
 * A bot's head, cropped to it.
 *
 * The other portrait of the same character — `BotAvatar` — is drawn from the
 * shoulders up, which is the right picture at the size the opponent grid uses
 * and the wrong one at 28px: shrink it to a row and the face is a third of the
 * tile, with the rest spent on a shirt. These are cropped to the head so the
 * character survives being small.
 *
 * Fetched rather than inlined, unlike `BotAvatar`. That one is inline because
 * the grid puts all eight up as the screen opens and empty tiles were showing;
 * here the row is decoration under a board, and eight traced SVGs of this
 * detail would cost the bundle more than the pictures cost the network.
 *
 * The corner follows `Avatar`'s rule — a quarter of the box — so a face beside
 * a player's picture is cut to the same shape.
 */
export function BotFace({ level, size = 28, className }: BotFaceProps) {
  return (
    <img
      src={`${FACE_BASE}/${getBot(level).id}.webp`}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      className={cn("block shrink-0 object-cover", className)}
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size / 4),
      }}
    />
  )
}
