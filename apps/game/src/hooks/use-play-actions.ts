import type { GameMode } from "@repo/abalone-engine/game-state"
import { useNavigate } from "@tanstack/react-router"
import { useCallback } from "react"
import { useAuthPrompt } from "@/providers/auth-prompt-provider"

/**
 * The ways into a game, wherever they are offered from — the tab bar's sheet,
 * the home page.
 *
 * Online is the one that needs an account, so signing in is a step on the way
 * there rather than a detour: `requireAuth` asks in whatever shape the screen
 * calls for and lands on the invite composer either way. There is no online
 * lobby to send anyone to any more — home is the lobby, and what "play online"
 * means is naming an opponent.
 *
 * Offline takes the mode as far as the URL. A caller that already knows which
 * of the two it is offering has no reason to drop the answer at the door and
 * make the setup panel ask again; one that doesn't — the home page's single
 * "play offline" — passes nothing and gets the default.
 */
export function usePlayActions() {
  const navigate = useNavigate()
  const { requireAuth } = useAuthPrompt()

  const playOffline = useCallback(
    (mode?: GameMode) =>
      navigate({ to: "/game/offline", search: { mode } }),
    [navigate],
  )

  const playOnline = useCallback(
    () => requireAuth({ redirect: "/invite" }),
    [requireAuth],
  )

  return { playOnline, playOffline }
}
