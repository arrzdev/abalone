import { cn } from "@repo/nativ/utils"
import { Link } from "@tanstack/react-router"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { BackIcon } from "@/components/icons"

/** The squares on this bar. Both of them, so the title is centred on the bar. */
export const SUBPAGE_HEADER_BUTTON =
  "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted transition-colors duration-200 ease-out hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"

export type SubpageHeaderProps = {
  title: string
  /** Where the arrow goes. Home, unless the page came from somewhere better. */
  backTo?: string
  /** The right-hand square, for the one thing a page can offer from up here. */
  action?: ReactNode
  className?: string
}

/**
 * The bar a secondary screen wears on a phone: back, title, and at most one
 * action.
 *
 * It replaces the app header and the tab bar rather than joining them. A phone
 * on the rules is doing one thing, and the way out of it is an arrow in the
 * corner — not a row of icons for the screens you are not on, plus a second row
 * at the bottom for the three you might want next.
 *
 * Above `lg` it is gone: the app header is on every screen up there and carries
 * the same destinations, and the way back is the browser's own.
 *
 * The arrow is a link rather than `history.back()`. A page opened from a
 * bookmark or a shared URL has nothing behind it, and an arrow that does nothing
 * is worse than one that goes somewhere.
 *
 * Safe padding on the outer box and the height on the one inside it: with
 * `box-border` a single box would let `h-14` swallow the inset instead of
 * clearing it.
 */
export function SubpageHeader({
  title,
  backTo = "/",
  action,
  className,
}: SubpageHeaderProps) {
  const { t } = useTranslation()

  return (
    <header
      className={cn(
        "shrink-0 border-b border-border-subtle bg-surface-2 px-safe pt-safe lg:hidden",
        className,
      )}
    >
      <div className="flex h-14 items-center gap-1 px-2">
        <Link
          to={backTo}
          aria-label={t("common:nav.back")}
          title={t("common:nav.back")}
          className={SUBPAGE_HEADER_BUTTON}
        >
          <BackIcon size={20} />
        </Link>

        <h1 className="min-w-0 flex-1 truncate px-1 text-center text-lg font-bold text-white">
          {title}
        </h1>

        {/* The square is there either way, so a title with nothing to its right
            is centred on the same line as one with a button there. */}
        <span className="flex h-10 w-10 shrink-0 items-center justify-center">
          {action}
        </span>
      </div>
    </header>
  )
}
