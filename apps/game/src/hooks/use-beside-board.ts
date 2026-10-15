import { useMediaQuery } from "@repo/nativ/hooks"

/**
 * The `beside` variant in `styles/main.css`, as a media query: the panel
 * beside the board rather than under it. A desktop, or a phone held sideways.
 */
export const BESIDE_QUERY =
  "(width >= 64rem) or ((width >= 40rem) and (height < 34rem))"

/** Whether the panel is beside the board right now. Never on the server. */
export function isBesideBoard(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia(BESIDE_QUERY).matches
  )
}

/**
 * Whether the panel is beside the board, for the places a CSS variant cannot
 * reach: whether the first-game guide is there at all.
 */
export function useBesideBoard(): boolean {
  return useMediaQuery(BESIDE_QUERY)
}
