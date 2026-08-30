import type { GameMode } from "@repo/abalone-engine/game-state"
import { createFileRoute, redirect } from "@tanstack/react-router"

/**
 * The old offline path. It is in the service worker's precache list and in the
 * shortcut anybody installed, so it keeps working.
 *
 * `?mode=` rides along: it seeds the setup panel, and dropping it here would
 * make an installed "play a bot" shortcut open on the wrong tab.
 */
export const Route = createFileRoute("/game/offline")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { mode?: GameMode } => ({
    mode:
      search.mode === "ai" || search.mode === "local"
        ? search.mode
        : undefined,
  }),
  beforeLoad: ({ search }) => {
    throw redirect({
      to: "/offline",
      search: { mode: search.mode },
      replace: true,
    })
  },
})
