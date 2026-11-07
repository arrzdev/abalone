import clara from "@/components/avatars/clara.gen.svg"
import gus from "@/components/avatars/gus.gen.svg"
import iris from "@/components/avatars/iris.gen.svg"
import magnus from "@/components/avatars/magnus.gen.svg"
import milo from "@/components/avatars/milo.gen.svg"
import nora from "@/components/avatars/nora.gen.svg"
import theo from "@/components/avatars/theo.gen.svg"
import victor from "@/components/avatars/victor.gen.svg"
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
