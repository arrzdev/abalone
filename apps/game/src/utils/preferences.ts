import tryCatch from "@repo/shared/try-catch"

/**
 * How a display preference is stored.
 *
 * The prefix and the JSON encoding are what the game already wrote to
 * localStorage before it moved onto the shell, and they are kept so a player's
 * settings survive the move. What has gone is the load/save pair that used to
 * live here — reading a preference is `usePersistentState`'s job now, and these
 * are the two halves of the codec it is handed.
 */
export const PREF_PREFIX = "abalone_"

/** A stored value, or undefined if it is not JSON any more. */
export function parseStored(raw: string): unknown {
  const [value] = tryCatch(() => JSON.parse(raw) as unknown)
  return value
}

export const serialize = (value: unknown) => JSON.stringify(value)
