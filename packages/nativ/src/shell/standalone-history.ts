import { createMemoryHistory } from "@tanstack/react-router"

//installed PWA (home-screen / standalone display) vs an in-browser tab. the media
//query covers modern iOS/Android; navigator.standalone covers legacy iOS Safari.
function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false
  const mql =
    window.matchMedia?.("(display-mode: standalone)").matches ?? false
  const iosLegacy =
    (window.navigator as { standalone?: boolean }).standalone === true
  return mql || iosLegacy
}

/**
 * History for `createRouter`: in-memory when installed / standalone (so the OS
 * edge-swipe is inert — no entry to navigate to), and `undefined` in a browser tab
 * so `createRouter` keeps its default browser history.
 *
 * Opt in by passing it as `history`. To disable, just don't pass it — `history` is
 * optional and defaults to browser history everywhere.
 *
 * @example
 * ```ts
 * createRouter({ routeTree, history: standaloneMemoryHistory() })
 * ```
 */
export function standaloneMemoryHistory():
  | ReturnType<typeof createMemoryHistory>
  | undefined {
  if (!isStandaloneDisplay()) return undefined
  return createMemoryHistory({
    initialEntries: [window.location.pathname + window.location.search],
  })
}
