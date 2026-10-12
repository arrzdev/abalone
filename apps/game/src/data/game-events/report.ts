import type { GameEventInput } from "@repo/backend/http/interface"
import { backendBaseUrl } from "@/data/backend-client"

//set by vite's `define`: the short commit the build came from, or "dev"
declare const __APP_VERSION__: string

//an omit that keeps the union, so a start still cannot carry a result
type WithoutAppVersion<T> = T extends unknown
  ? Omit<T, "appVersion">
  : never

/** A game event as the game describes it; the build is added on the way out. */
export type GameEvent = WithoutAppVersion<GameEventInput>

const EVENTS_PATH = "/api/v1/events/game"

function appVersion(): string {
  return typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "dev"
}

//a test is driving the browser: our e2e and smoke checks. said only when true,
//so a player's event is the same as before
function automatedField(): { automated?: true } {
  if (typeof navigator === "undefined") return {}
  return navigator.webdriver === true ? { automated: true } : {}
}

//true when the browser took it. a beacon outlives the page, which is the whole
//point when the event is the page closing
function sendAsBeacon(url: string, body: string): boolean {
  if (typeof navigator === "undefined") return false
  if (typeof navigator.sendBeacon !== "function") return false
  try {
    return navigator.sendBeacon(url, body)
  } catch {
    return false
  }
}

function sendAsFetch(url: string, body: string): void {
  if (typeof fetch !== "function") return
  try {
    fetch(url, { method: "POST", body, keepalive: true }).catch(() => {})
  } catch {
    //nothing to do: a count we miss is a count we miss
  }
}

/**
 * Tells the backend a bot or pass and play game started or finished.
 *
 * Fire and forget. Nothing here may get in the way of the game, so every
 * failure is swallowed, and offline the event is simply dropped: the numbers
 * are for trends, and a queue would be one more thing that can break.
 */
export function reportGameEvent(event: GameEvent): void {
  const url = `${backendBaseUrl}${EVENTS_PATH}`
  const body = JSON.stringify({
    ...event,
    appVersion: appVersion(),
    ...automatedField(),
  })
  if (sendAsBeacon(url, body)) return
  sendAsFetch(url, body)
}
