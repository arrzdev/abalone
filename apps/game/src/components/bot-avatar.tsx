import clara from "@/components/avatars/clara.webp"
import gus from "@/components/avatars/gus.webp"
import iris from "@/components/avatars/iris.webp"
import magnus from "@/components/avatars/magnus.webp"
import milo from "@/components/avatars/milo.webp"
import nora from "@/components/avatars/nora.webp"
import theo from "@/components/avatars/theo.webp"
import victor from "@/components/avatars/victor.webp"
import { getBot } from "@/i18n/bots"

/**
 * Which face belongs to which character.
 *
 * Keyed by the character's id and not by their level, for the reason the ids
 * exist at all: reordering the ladder should move a face up it rather than
 * repaint someone else's.
 */
const PORTRAITS: Record<string, string> = {
  gus,
  milo,
  nora,
  theo,
  iris,
  victor,
  clara,
  magnus,
}

export interface BotAvatarProps {
  /** The ladder position whose character to draw. */
  level: number
  className?: string
  /** `lazy` for a face that opens off screen. Default `eager`. */
  loading?: "eager" | "lazy"
}

/**
 * The portrait of whoever sits at a level.
 *
 * Fetched as a hashed file rather than drawn inline. Inline, the eight traced
 * portraits were most of the page's script and, rendered on the server, most
 * of its HTML too. As files, the browser fetches them while it parses the page
 * and caches them for good, and the service worker precaches them for offline
 * play. The callers reserve a square box, so a face that lands late does not
 * move the grid.
 *
 * A 256px WebP crop rather than the traced vector in `assets/avatars/`: the
 * vector is 45-190 KB a face and all eight are on the screen at once, so on a
 * phone they queued ahead of the page's own script and held the first
 * portrait's paint back by seconds. The WebPs are 7-14 KB and the biggest
 * tile is 80 CSS px, so 256px stays sharp up to 3x.
 *
 * The art is square, so it fills whatever box the caller sizes: pass the size
 * as a class, the way `Logo` takes one.
 *
 * Decorative: the name is spelled out beside every place this appears.
 *
 * Falls back to the first character the same way `getBot` does, so a level
 * added to the ladder before its portrait exists draws a face rather than a
 * hole.
 */
export function BotAvatar({
  level,
  className,
  loading = "eager",
}: BotAvatarProps) {
  return (
    <img
      src={PORTRAITS[getBot(level).id] || gus}
      alt=""
      loading={loading}
      decoding="async"
      draggable={false}
      className={className}
    />
  )
}
