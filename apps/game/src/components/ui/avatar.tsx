import { Image } from "@repo/nativ/components"
import { cn } from "@repo/nativ/utils"

export type AvatarProps = {
  /** The picture. Null, missing or unloadable all fall back to the initial. */
  src?: string | null
  /** Whose face this is. Its first letter is the fallback. */
  name?: string | null
  /** Square side, in px. Default 36. */
  size?: number
  className?: string
}

/**
 * A player's picture, or the first letter of their name standing in for one.
 *
 * The letter is the point. The eight portraits in this app belong to the eight
 * bots, so an anonymous head next to a human name reads as a ninth bot — and a
 * row of them reads as a row of nobodies. An initial is the one thing that is
 * always available, always different between two players, and never mistakable
 * for a face.
 *
 * The fallback fills the same box as the picture, so a photo arriving later
 * moves nothing beside it.
 */
export function Avatar({ src, name, size = 36, className }: AvatarProps) {
  //the corner tracks the box: a fixed radius that reads as a rounded square at
  //28px reads as a barely-nicked one at 44
  const radius = Math.round(size * 0.25)

  const initial = (name ?? "").trim().slice(0, 1)
  //no fill of its own — the box behind it already has one. a second copy of the
  //same colour inside a rounded `overflow-hidden` paints a square corner over
  //the antialiased one and leaves the edge looking notched
  const fallback = (
    <span
      className="flex size-full items-center justify-center font-display font-bold text-white/85 uppercase"
      style={{ fontSize: Math.round(size * 0.42) }}
    >
      {initial}
    </span>
  )

  return (
    <div
      className={cn("shrink-0 overflow-hidden bg-avatar-well", className)}
      style={{ width: size, height: size, borderRadius: radius }}
    >
      <Image src={src} alt="" className="size-full object-cover">
        {/* No picture yet, and a picture that would not load: the same letter. */}
        <Image.Invalid>{fallback}</Image.Invalid>
        <Image.Error>{fallback}</Image.Error>
      </Image>
    </div>
  )
}
