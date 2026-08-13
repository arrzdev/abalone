import { PwaSplashOverlay } from "@repo/nativ/components"
import type { SplashScreenProps } from "@repo/nativ/config"
import { useEffect, useRef } from "react"
import { Logo } from "@/components/logo"

//long enough that the mark reads as a splash rather than a flash, short enough
//that it never delays a player who is already tapping
const SPLASH_MS = 600

//standalone only: anchor the centering region to the frozen launch-viewport
//height at top:0. on an iOS standalone cold start the ICB paints small then
//expands after first paint, which would re-center the mark downward — the
//launch shift. the coverage box stays `fixed inset-0`, so its bottom can never
//leak the board even if the frozen height comes in short.
const SPLASH_CENTER_CLASS =
  "app:h-[var(--pwa-launch-height,100lvh)] app:bottom-auto!"

/**
 * Boot overlay: the mark, then the game.
 *
 * There is nothing to wait for — no database to open, no session to restore —
 * so this dismisses on a timer rather than on a readiness gate. The wait it
 * covers is the client bundle parsing, which is over before the timer is.
 */
export function SplashScreen({ hide }: SplashScreenProps) {
  const hideRef = useRef(hide)
  hideRef.current = hide

  useEffect(() => {
    const timeout = setTimeout(() => hideRef.current(), SPLASH_MS)
    return () => clearTimeout(timeout)
  }, [])

  return (
    <PwaSplashOverlay centerClassName={SPLASH_CENTER_CLASS}>
      <Logo className="w-28 animate-splash-mark" />
    </PwaSplashOverlay>
  )
}

export default SplashScreen
