import tryCatch from "@repo/shared/try-catch"
import { useCallback, useEffect, useRef, useState } from "react"

//every mounted hook for a key hears every write to it, so two screens sharing a
//preference can't drift apart — the settings sheet and the page behind it are
//the pair that would. localStorage's own `storage` event is no help: it fires
//in the other tabs, never the one that wrote.
const subscribers = new Map<string, Set<(next: unknown) => void>>()

//localStorage-backed preference — read synchronously on mount so the first
//paint already reflects the stored choice (no flash of the default). The game
//never needs these in the url: shareability isn't a goal, and surviving a
//reload is exactly what localStorage gives us. `parse` validates the stored raw
//string (stale/garbage falls back); `format` returning null clears the key, so
//"default" values stay out of storage.
export function usePersistentState<T>(
  key: string,
  fallback: T,
  parse: (raw: string) => T | null,
  format: (value: T) => string | null,
): readonly [T, (next: T) => void] {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return fallback
    const [raw] = tryCatch(() => localStorage.getItem(key))
    if (raw == null) return fallback
    return parse(raw) ?? fallback
  })

  //callers pass an inline `format`, so its identity churns every render; read it
  //through a ref so `set` stays stable (deps = [key]) without going stale
  const formatRef = useRef(format)
  formatRef.current = format

  useEffect(() => {
    const listeners = subscribers.get(key) ?? new Set()
    subscribers.set(key, listeners)
    const listener = (next: unknown) => setValue(next as T)
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
      if (listeners.size === 0) subscribers.delete(key)
    }
  }, [key])

  const set = useCallback(
    (next: T) => {
      setValue(next)
      if (typeof window === "undefined") return
      const serialized = formatRef.current(next)
      tryCatch(() =>
        serialized == null
          ? localStorage.removeItem(key)
          : localStorage.setItem(key, serialized),
      )
      //the writer's own listener sets the value it already holds, which React
      //bails on — no need to single it out
      for (const listener of subscribers.get(key) ?? []) listener(next)
    },
    [key],
  )

  return [value, set] as const
}
