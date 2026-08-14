import type { RefObject } from "react"
import { useEffect } from "react"

/** Calls `handler` on a pointer press outside `ref`, while `active` is true. */
export function useClickOutside(
  ref: RefObject<HTMLElement | null>,
  handler: (event: Event) => void,
  active = true,
): void {
  useEffect(() => {
    if (!active) return
    const onPointerDown = (event: Event) => {
      if (!ref.current?.contains(event.target as Node | null)) {
        handler(event)
      }
    }
    document.addEventListener("mousedown", onPointerDown)
    document.addEventListener("touchstart", onPointerDown)
    return () => {
      document.removeEventListener("mousedown", onPointerDown)
      document.removeEventListener("touchstart", onPointerDown)
    }
  }, [active, handler, ref])
}
