import type { GameMode } from "@repo/abalone-engine/game-state"
import { useNavigate } from "@tanstack/react-router"
import { useCallback } from "react"
import { useAuthPrompt } from "@/providers/auth-prompt-provider"

/**
 * The ways into a game, wherever they are offered from — home, the hub's own
 * empty state.
 *
 * Online is the one that needs an account, so signing in is a step on the way
 * there rather than a detour: `requireAuth` asks over whatever screen is up and
 * lands on the invite composer either way. What "play online" means is naming an
 * opponent, so it goes to the hub with the composer already open rather than to
 * the hub for you to find the button again.
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
    (mode?: GameMode) => navigate({ to: "/offline", search: { mode } }),
    [navigate],
  )

  const playOnline = useCallback(
    () => requireAuth({ redirect: "/invite" }),
    [requireAuth],
  )

  return { playOnline, playOffline }
}
