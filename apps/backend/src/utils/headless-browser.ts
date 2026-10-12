/**
 * True for a browser with no screen: our own e2e and smoke checks, and other
 * bots. Read off the user agent and never stored (docs/game-events.md).
 *
 * Headless Chromium says so in its user agent. A device-emulating run does
 * not, which is why the game also says `automated` itself.
 */
export function isHeadlessBrowser(userAgent: string | undefined): boolean {
  if (!userAgent) return false
  return /\bHeadless/i.test(userAgent)
}
