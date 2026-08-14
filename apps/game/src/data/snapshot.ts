//---- Local snapshots ----------------
//the last answer this device got to a question it is going to ask again. a
//snapshot exists so a cold start can paint the right thing before the network
//says anything: without one, every boot shows a signed-out shell for a round
//trip and then swaps, which is exactly the flash the app is meant not to have.
//
//a snapshot is a CACHE, never the authority. whoever reads one serves it only
//until the real value resolves, and the real value always wins after that.

export function readSnapshot<T>(key: string): T | null {
  if (typeof localStorage === "undefined") return null
  const stored = localStorage.getItem(key)
  if (!stored) return null

  try {
    return JSON.parse(stored) as T
  } catch {
    //raw try/catch: JSON.parse is sync and the only recovery is "act as if there
    //were no snapshot", so a [value, error] tuple would have nothing to add. a
    //half-written or hand-edited value is not worth crashing the boot over.
    return null
  }
}

export function writeSnapshot<T>(key: string, value: T): void {
  if (typeof localStorage === "undefined") return
  localStorage.setItem(key, JSON.stringify(value))
}

export function clearSnapshot(key: string): void {
  if (typeof localStorage === "undefined") return
  localStorage.removeItem(key)
}
