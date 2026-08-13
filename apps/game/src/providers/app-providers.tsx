import type { ReactNode } from "react"
//side-effect: initialises i18next before any component asks for a string
import "@/i18n"

/**
 * App-wide provider tree mounted by the nativ shell around the router outlet.
 *
 * Thin on purpose. The game holds no server state and signs nobody in, so there
 * is no query client and no auth context here — the whole of it is one
 * side-effect import that has to run before the first `t()`.
 */
export default function AppProviders({
  children,
}: {
  children: ReactNode
}) {
  return children
}
