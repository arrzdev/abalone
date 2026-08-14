import { Image } from "@repo/nativ/components"
import { cn } from "@repo/nativ/utils"
import { PersonIcon } from "@/components/icons"

export type AvatarProps = {
  /** The picture. Null, missing or unloadable all fall back to the same head. */
  src?: string | null
  /** Square side, in px. Default 36. */
  size?: number
  className?: string
}

const FALLBACK_CLASS =
  "flex items-center justify-center bg-black/25 text-white/35"

/**
 * A player's picture, or the anonymous head standing in for one.
 *
 * The fallback is a placeholder rather than nothing, so the box is the same size
 * either way and a picture arriving does not move whatever sits beside it.
 */
export function Avatar({ src, size = 36, className }: AvatarProps) {
  const fallback = <PersonIcon size={Math.round(size * 0.64)} />

  return (
    <div
      className={cn(
        "shrink-0 overflow-hidden rounded-lg bg-black/25",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <Image src={src} alt="" className="size-full object-cover">
        {/* No picture yet, and a picture that would not load: the same head. */}
        <Image.Invalid className={FALLBACK_CLASS}>
          {fallback}
        </Image.Invalid>
        <Image.Error className={FALLBACK_CLASS}>{fallback}</Image.Error>
      </Image>
    </div>
  )
}
