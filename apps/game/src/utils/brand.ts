/**
 * The game's name, and the joke name it wears on one host.
 *
 * Nothing here is a translation: "Abalone" is a proper noun and reads the same
 * in all thirteen languages, which is exactly why a single find-and-replace over
 * finished text is enough to rename the whole app.
 */
/** The name in the head and in every finished string off the egg host. */
export const BRAND = "Abalone"
const EASTER_EGG_BRAND = "Babaluje"

//the word anywhere in the hostname turns it on — `babaluje.tld`,
//`babaluje.example.com`, `babaluje.localhost`, a preview host with it in the
//middle. the egg is the domain, so the domain is the only switch
const EASTER_EGG_HOSTNAME = /babaluje/i

const BRAND_OCCURRENCE = /abalone/gi

/**
 * The replacement wearing the same case as the word it stands in for, so
 * "ABALONE" stays a shout and "abalone" inside a sentence stays lowercase.
 */
function matchCase(occurrence: string, replacement: string): string {
  if (occurrence === occurrence.toUpperCase())
    return replacement.toUpperCase()
  if (occurrence[0] === occurrence[0].toLowerCase()) {
    return replacement.toLowerCase()
  }
  return replacement
}

/** Whether this host is the one the egg hatches on. */
export function isEasterEggHostname(hostname: string): boolean {
  return EASTER_EGG_HOSTNAME.test(hostname)
}

/** Every "Abalone" in a string, renamed — case kept, the rest untouched. */
export function renameBrand(
  text: string,
  replacement = EASTER_EGG_BRAND,
): string {
  return text.replace(BRAND_OCCURRENCE, (occurrence) =>
    matchCase(occurrence, replacement),
  )
}

/**
 * Read on every call rather than once at load: it costs a property read, and it
 * keeps the whole module free of state a test would have to reset.
 */
function isEasterEggActive(): boolean {
  if (typeof window === "undefined") return false
  return isEasterEggHostname(window.location.hostname)
}

/** A finished string as this host should show it. Off the egg host, itself. */
export function brandText(text: string): string {
  if (!isEasterEggActive()) return text
  return renameBrand(text)
}

/** The game's name as this host should show it. */
export function brandName(): string {
  return brandText(BRAND)
}

/**
 * One pass over the head. Writes only what the rename actually changes, which
 * is what keeps the observer below from setting off its own callback forever.
 */
function renameHead(): void {
  const title = brandText(document.title)
  if (title !== document.title) document.title = title

  for (const meta of document.head.querySelectorAll("meta[content]")) {
    const content = meta.getAttribute("content")
    if (!content) continue

    const renamed = brandText(content)
    if (renamed !== content) meta.setAttribute("content", renamed)
  }
}

/**
 * Renames the head, which no translation reaches: the tab title and the meta
 * tags are baked into the shell at build time from `nativ.config`, so the egg
 * has to rewrite them in place once the document exists.
 *
 * Kept renamed rather than renamed once — the router owns the head and rewrites
 * it on hydration and on every navigation, so a single pass is overwritten a
 * frame after it runs.
 */
export function applyBrandToDocument(): void {
  if (typeof document === "undefined") return
  if (!isEasterEggActive()) return

  renameHead()

  new MutationObserver(renameHead).observe(document.head, {
    subtree: true,
    childList: true,
    characterData: true,
    attributeFilter: ["content"],
  })
}
