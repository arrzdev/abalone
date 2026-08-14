import { cn } from "@repo/nativ/utils"
import { Link } from "@tanstack/react-router"
import type { ReactNode } from "react"

export type NavLinkProps = {
  to: string
  /** Match the whole path rather than its prefix. Needed by `/`. */
  exact?: boolean
  /** Applied always. */
  className?: string
  /** Applied only while this is the route being shown. */
  activeClassName?: string
  /** Applied only while it is not. */
  inactiveClassName?: string
  "aria-label"?: string
  /** The hover tooltip, for a destination whose label is only its icon. */
  title?: string
  children: ReactNode
}

/**
 * A navigation destination: routing, active matching and a focus ring. No paint
 * of its own — the header and the tab bar dress it differently.
 *
 * This wraps TanStack's `Link` rather than nativ's, which has a closed props
 * type with no `activeOptions`: without it `/` prefix-matches every route and
 * two destinations report themselves active at once, with no way to correct it
 * from the call site. The trade is nativ's tap-vs-scroll discrimination, which
 * costs nothing here because both bars sit outside every scroller.
 */
export function NavLink({
  to,
  exact = false,
  className,
  activeClassName,
  inactiveClassName,
  children,
  ...props
}: NavLinkProps) {
  return (
    <Link
      to={to}
      activeOptions={{ exact }}
      className={cn(
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
        className,
      )}
      activeProps={{ className: cn(activeClassName) }}
      inactiveProps={{ className: cn(inactiveClassName) }}
      {...props}
    >
      {children}
    </Link>
  )
}
