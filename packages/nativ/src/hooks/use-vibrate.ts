import type { MouseEvent } from "react"
import { useCallback } from "react"
import { installVibratePolyfill } from "#nativ/utils/install-vibrate-polyfill"

// Must run synchronously inside a click/tap handler on iOS 18.4+
let lastVibrateAt = 0

const VIBRATE_COOLDOWN_MS = 200

/**
 * Web only exposes `navigator.vibrate` (no real haptic engine), so the native
 * selection/impact/notification taxonomy is approximated with short pulses and
 * patterns. On the iOS `<input switch>` polyfill, patterns collapse to a single
 * tap — semantics degrade gracefully.
 */
type VibrateKind =
  | "ok"
  | "success"
  | "cancel"
  | "selection"
  | "impact"
  | "warning"
  | "error"

/** Kinds wired into pointer/tap feedback via {@link useVibrate} handlers. */
type PointerVibrateKind = Extract<VibrateKind, "ok" | "success" | "cancel">

const VIBRATE_DURATIONS: Record<VibrateKind, VibratePattern> = {
  ok: 22,
  success: 40,
  cancel: 14,
  selection: 8,
  impact: 26,
  warning: [26, 50, 26],
  error: [40, 50, 40],
}

/** Whether haptic feedback is available (installs the iOS polyfill first). */
export function canVibrate(): boolean {
  if (typeof navigator === "undefined") return false
  installVibratePolyfill()
  return typeof navigator.vibrate === "function"
}

function pulse(pattern: VibratePattern) {
  if (typeof navigator === "undefined" || !navigator.vibrate) return

  const now = Date.now()
  if (now - lastVibrateAt < VIBRATE_COOLDOWN_MS) return
  lastVibrateAt = now

  navigator.vibrate(pattern)
}

function fireVibrate(kind: VibrateKind) {
  pulse(VIBRATE_DURATIONS[kind])
}

function pointerTypeFromClick(e: MouseEvent<HTMLElement>): string {
  if ("pointerType" in e.nativeEvent) {
    return (e.nativeEvent as PointerEvent).pointerType
  }
  return "mouse"
}

export function useVibrate() {
  installVibratePolyfill()

  const vibrateOk = useCallback(() => fireVibrate("ok"), [])
  const vibrateSuccess = useCallback(() => fireVibrate("success"), [])
  const vibrateCancel = useCallback(() => fireVibrate("cancel"), [])
  const vibrateSelection = useCallback(() => fireVibrate("selection"), [])
  const vibrateImpact = useCallback(() => fireVibrate("impact"), [])
  const vibrateWarning = useCallback(() => fireVibrate("warning"), [])
  const vibrateError = useCallback(() => fireVibrate("error"), [])

  const hapticPointerHandlers = useCallback(
    (handler: () => void, kind: PointerVibrateKind) => ({
      onTouchEnd: () => fireVibrate(kind),
      onClick: (e: MouseEvent<HTMLElement>) => {
        if (pointerTypeFromClick(e) !== "touch") fireVibrate(kind)
        handler()
      },
    }),
    [],
  )

  return {
    vibrateOk,
    vibrateSuccess,
    vibrateCancel,
    vibrateSelection,
    vibrateImpact,
    vibrateWarning,
    vibrateError,
    canVibrate,
    hapticPointerHandlers,
  }
}
