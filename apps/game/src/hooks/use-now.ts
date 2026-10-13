import { useEffect, useState } from "react"

/**
 * The time, read again every `intervalMs`.
 *
 * For text that says how long ago something was: "5 min ago" is a lie a minute
 * later, and nothing else on the screen changes to make it render again.
 */
export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])

  return now
}
