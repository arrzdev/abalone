import { useSyncExternalStore } from "react"

function subscribe(onChange: () => void) {
  if (typeof window === "undefined") return () => {}

  window.addEventListener("online", onChange)
  window.addEventListener("offline", onChange)
  return () => {
    window.removeEventListener("online", onChange)
    window.removeEventListener("offline", onChange)
  }
}

function getSnapshot(): boolean {
  if (typeof navigator === "undefined") return true
  return navigator.onLine
}

function getServerSnapshot(): boolean {
  return true
}

/**
 * Reactive network reachability — `true` when the browser reports online.
 * Optimistically returns `true` during SSR and before hydration. Note the
 * platform signal is coarse: `navigator.onLine` only guarantees a network
 * interface, not real connectivity.
 */
export function useNetworkStatus(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
