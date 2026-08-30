/**
 * Where the game answers from, as a link somewhere else has to write it.
 *
 * Every social card is built by a machine that never runs the app: it reads the
 * head out of the HTML on some other host and follows what it finds there, so a
 * root-relative `/images/social/og-home.png` resolves against the sharer, not
 * against us. Absolute is the only form that survives the trip.
 *
 * One origin rather than the current one, and deliberately: the game also
 * answers on the babaluje host (see `@/utils/brand`), and a card that names
 * whichever host the link was copied from is two identities instead of one.
 *
 * `nativ.config.ts` spells this out again for the head it stamps at build time.
 * It is loaded by esbuild outside the app's alias resolution, so it cannot
 * import this — the two have to agree by hand.
 */
export const SITE_ORIGIN = "https://abalone.tudu.dev"

/** An app-relative path as the absolute URL a crawler can actually fetch. */
export function siteUrl(path: string): string {
  return `${SITE_ORIGIN}${path}`
}
