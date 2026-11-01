import { Image } from "@repo/nativ/components"
import { cn } from "@repo/nativ/utils"
import {
  AVATAR_FALLBACK_TEXT_COLOR,
  getAvatarColor,
  getInitials,
} from "@/utils/avatar-fallback"

export type AvatarProps = {
  /** The picture. Null, missing or unloadable all fall back to the initials. */
  src?: string | null
  /** Whose face this is. Its initials, on a colour of their own, are the fallback. */
  name?: string | null
  /** Square side, in px. Default 36. */
  size?: number
  className?: string
}

/**
 * A player's picture, or their initials on a colour standing in for one.
 *
 * The initials are the point. The eight portraits in this app belong to the
 * eight bots, so an anonymous head next to a human name reads as a ninth bot,
 * and a row of them reads as a row of nobodies. Initials are the one thing that
 * is always available and never mistakable for a face, and the colour, picked
 * from the name, tells two players apart at a glance and is the same wherever
 * that player turns up.
 *
 * The fallback fills the same box as the picture, so a photo arriving later
 * moves nothing beside it.
 */
export function Avatar({ src, name, size = 36, className }: AvatarProps) {
  //the corner tracks the box: a fixed radius that reads as a rounded square at
  //28px reads as a barely-nicked one at 44
  const radius = Math.round(size * 0.25)

  const initials = getInitials(name)
  //the fill goes on the layer that holds the letters, so it shows only when
  //they do: while a photo is on its way the box behind it is still the quiet
  //well, and a player with a picture never sees a flash of their colour
  const fallbackLayer = { backgroundColor: getAvatarColor(name) }
  const fallback = (
    <span
      data-avatar-initials
      className="flex size-full items-center justify-center font-display font-bold"
      style={{
        color: AVATAR_FALLBACK_TEXT_COLOR,
        fontSize: Math.round(size * (initials.length > 1 ? 0.36 : 0.42)),
      }}
    >
      {initials}
    </span>
  )

  return (
    <div
      //`isolate` keeps the picture's own stacking (it paints at z-10) inside the
      //box, so a badge or menu laid over an avatar is never under its photo
      className={cn(
        "shrink-0 isolate overflow-hidden bg-avatar-well",
        className,
      )}
      style={{ width: size, height: size, borderRadius: radius }}
    >
      <Image src={src} alt="" className="size-full object-cover">
        {/* No picture yet, and a picture that would not load: the same letter. */}
        <Image.Invalid style={fallbackLayer}>{fallback}</Image.Invalid>
        <Image.Error style={fallbackLayer}>{fallback}</Image.Error>
      </Image>
    </div>
  )
}
