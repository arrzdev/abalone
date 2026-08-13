import { PwaSplashOverlay } from "@repo/nativ/components"
import type { SplashScreenProps } from "@repo/nativ/config"
import type { CSSProperties } from "react"
import { useEffect, useRef } from "react"
import { useAppBootstrapReady } from "@/data/app-bootstrap-ready"

//---- Splash dismiss -----------------------------------------------------------
const SPLASH_MIN_MS = 650
const SPLASH_POST_READY_MS = 100

//---- Splash screen animation settings ----------------------------------------
const SPLASH_WORDMARK = "ABALONE"
const SPLASH_FILL_MS = 700
const SPLASH_PULSE_DELAY_MS = 750
const SPLASH_PULSE_MS = 1700

// Standalone only: anchor the splash's *centering region* (not the coverage box) to the
// frozen launch-viewport height at top:0. On an iOS standalone cold start the ICB paints
// small then expands after first paint, which would re-center the wordmark downward — the
// launch shift. `--pwa-launch-height` is captured pre-paint from the resolved 100vh
// (getLaunchViewportInitScript), so the centering region is stable from the first frame.
// The coverage box stays `fixed inset-0` (live viewport), so its bottom can never leak app
// content even if the frozen height comes in short. In the browser there's no shift, so the
// region keeps inset-0 (lvh fallback) and a frozen height can't fight the address bar.
const SPLASH_CENTER_CLASS =
  "app:h-[var(--pwa-launch-height,100lvh)] app:bottom-auto!"

const splashStyle = {
  "--splash-fill-ms": `${SPLASH_FILL_MS}ms`,
  "--splash-pulse-delay-ms": `${SPLASH_PULSE_DELAY_MS}ms`,
  "--splash-pulse-ms": `${SPLASH_PULSE_MS}ms`,
} as CSSProperties

//---- Splash screen component --------------------------------------------------
export function SplashScreen({ hide }: SplashScreenProps) {
  const ready = useAppBootstrapReady()
  const mountedAt = useRef(Date.now())

  useEffect(() => {
    if (!ready) return

    const elapsed = Date.now() - mountedAt.current
    const delay = Math.max(SPLASH_MIN_MS - elapsed, SPLASH_POST_READY_MS)
    const timeout = setTimeout(hide, delay)
    return () => clearTimeout(timeout)
  }, [ready, hide])

  return (
    <PwaSplashOverlay
      centerClassName={SPLASH_CENTER_CLASS}
      style={splashStyle}
    >
      <p className="relative m-0 origin-center text-center font-sans text-4xl font-bold tracking-[0.22em] uppercase animate-splash-wordmark-pulse">
        <span className="block text-primary/30">{SPLASH_WORDMARK}</span>
        <span
          aria-hidden
          className="absolute inset-0 block text-primary animate-splash-wordmark-fill"
        >
          {SPLASH_WORDMARK}
        </span>
      </p>
    </PwaSplashOverlay>
  )
}

export default SplashScreen
