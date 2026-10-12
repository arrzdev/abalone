import type { GameMode } from "@repo/abalone-engine/game-state"
import { useNavigate } from "@tanstack/react-router"
import { useCallback } from "react"
import { useAuthPrompt } from "@/providers/auth-prompt-provider"

/**
 * The computer game: where home's vs Computer card goes, and where a page that
 * offers a game against the computer sends you. One place, so that where a
 * first game against the computer lands is decided once.
 *
 * A route, its search and its state rather than a string, so a `Link` can take
 * it as is and a crawler still finds a plain `href`. The state asks `/offline`
 * to start on the board; it decides whether it does (`startsOnBoard`), and it
 * stays out of the URL search engines see.
 */
export const COMPUTER_GAME = {
  to: "/offline",
  search: { mode: "ai" },
  state: { startOnBoard: true },
} as const

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
 *
 * It also asks for the game to start on the board. `/offline` decides whether it
 * does (a first game against the computer, see `startsOnBoard`); the URL stays
 * the one search engines see.
 */
export function usePlayActions() {
  const navigate = useNavigate()
  const { requireAuth } = useAuthPrompt()

  const playOffline = useCallback(
    (mode?: GameMode) =>
      navigate({
        to: "/offline",
        search: { mode },
        state: { startOnBoard: true },
      }),
    [navigate],
  )

  const playOnline = useCallback(
    () => requireAuth({ redirect: "/online" }),
    [requireAuth],
  )

  return { playOnline, playOffline }
}
