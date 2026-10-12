import { useEffect } from "react"
import { BRAND, brandText } from "@/utils/brand"

/**
 * The tab title for a state of a page that its route's head cannot see.
 *
 * The head is the route's, and a route knows its path, not what the page is
 * doing on it — so a page that becomes something else in place (a setup screen
 * that turns into a game) names itself here. `title` is the page's own name and
 * gets the brand appended, the same shape `pageHead` writes. `null` leaves the
 * route's head alone.
 *
 * On the way out the title goes back to what it was, but only if it is still
 * ours: when the page is left for another route, the router has already written
 * that route's title, and putting this one's back would overwrite it.
 */
export function useDocumentTitle(title: string | null): void {
  useEffect(() => {
    if (title === null) return

    const previous = document.title
    const next = brandText(`${title} · ${BRAND}`)
    document.title = next

    return () => {
      if (document.title === next) document.title = previous
    }
  }, [title])
}
