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
 * lands on the hub either way.
 *
 * The hub, and nothing on top of it. It used to arrive with the invite composer
 * already open, on the grounds that playing online means naming an opponent —
 * but that is a form over a screen you have not seen yet, and on a phone it is a
 * drawer covering the thing you pressed the button to reach. The hub asks for a
 * new invite in its own words, and it is the first thing on it when there is
 * nothing else.
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
    () => requireAuth({ redirect: "/online" }),
    [requireAuth],
  )

  return { playOnline, playOffline }
}
