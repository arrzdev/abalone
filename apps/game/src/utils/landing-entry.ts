import type { GameEventInput } from "@repo/backend/http/interface"
import tryCatch from "@repo/shared/try-catch"

/** The kind of page a browser tab first landed on, as a game start sends it. */
export type GameEntry = NonNullable<
  Extract<GameEventInput, { kind: "start" }>["entry"]
>

/** sessionStorage, as far as the entry needs it. */
export type EntryStorage = Pick<Storage, "getItem" | "setItem">

/**
 * Where the tab's landing is kept. sessionStorage, so it lives as long as the
 * tab does: a reload keeps it, a new tab starts over.
 */
export const ENTRY_STORAGE_KEY = "abalone.entry.v1"

const ENTRIES: ReadonlySet<string> = new Set<GameEntry>([
  "home",
  "rules",
  "strategy",
  "invite",
  "other",
])

const PAGE_ENTRIES: ReadonlyMap<string, GameEntry> = new Map([
  ["", "home"],
  ["/rules", "rules"],
  ["/strategy", "strategy"],
])

const INVITE_PATH = /^\/invite\/[^/]+$/

function isGameEntry(
  value: string | null | undefined,
): value is GameEntry {
  return typeof value === "string" && ENTRIES.has(value)
}

/** The kind of page a path is. Only this word ever leaves the browser. */
export function entryOf(pathname: string): GameEntry {
  const path = pathname.replace(/\/+$/, "")
  const pageEntry = PAGE_ENTRIES.get(path)
  if (pageEntry) return pageEntry
  if (INVITE_PATH.test(path)) return "invite"
  return "other"
}

/**
 * The page this tab first landed on: the one an earlier load saved, or
 * `pathname` when this load is the first.
 *
 * Storage that refuses still gets an answer, the current page's.
 */
export function landingEntry(
  pathname: string,
  storage: EntryStorage,
): GameEntry {
  const [saved] = tryCatch(() => storage.getItem(ENTRY_STORAGE_KEY))
  if (isGameEntry(saved)) return saved

  const entry = entryOf(pathname)
  tryCatch(() => storage.setItem(ENTRY_STORAGE_KEY, entry))
  return entry
}

//---- this page load ----------------

//the landing as this page load knows it, so storage that refuses still sends
//the page the load began on rather than the one the player has walked to
let landedOn: GameEntry = "other"

//a stand in for sessionStorage when the browser will not even hand it over
const noStorage: EntryStorage = {
  getItem: () => null,
  setItem: () => {},
}

/**
 * Settles the tab's landing from the address this load began on. Call once,
 * before the router runs: a redirect or a tap moves the address after that.
 */
export function rememberLanding(): void {
  //reading `sessionStorage` itself throws where cookies are blocked
  const [storage] = tryCatch(() => window.sessionStorage)
  landedOn = landingEntry(window.location.pathname, storage ?? noStorage)
}

/** The page this tab first landed on, as `rememberLanding` settled it. */
export function landedEntry(): GameEntry {
  return landedOn
}
