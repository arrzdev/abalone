import { useMediaQuery } from "@repo/nativ/hooks"

/** Tailwind's `lg`, the one breakpoint the shell changes shape at. */
export const DESKTOP_QUERY = "(min-width: 64rem)"

/**
 * Whether the pointer-and-hover layout is the one on screen.
 *
 * Only for the places a CSS variant cannot reach: choosing between two
 * different components, or a hover interaction that has no touch equivalent.
 * Anything that is the same element painted differently stays a `lg:` class.
 */
export function useIsDesktop(): boolean {
  return useMediaQuery(DESKTOP_QUERY)
}
