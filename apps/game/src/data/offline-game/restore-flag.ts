import { OFFLINE_GAME_KEY } from "@/data/offline-game/snapshot"

//the setup screen is in the prerendered HTML of /offline, so a reload that is
//about to put a game back would show the setup screen first, for as long as the
//page takes to hydrate. this flag is how the page says "a game is coming back"
//before any of that is painted: a script in the head sets it on <html>, the
//stylesheet keeps the page body out of sight while it is set (`main.css`), and
//the page clears it in the layout effect that follows the restore.

/** The attribute on <html> while a saved game is on its way back. */
export const OFFLINE_RESTORE_ATTRIBUTE = "data-offline-restore"

/**
 * The inline script that sets the flag. Plain ES5 and no imports, because it is
 * written into the document as text and runs before anything else has loaded.
 * Only on /offline, in any language prefix, and only for a save that looks like
 * a live game: the page does the real validation, and clears the flag whichever
 * way that goes.
 */
export const OFFLINE_RESTORE_SCRIPT = `(function(){try{if(!/(^|\\/)offline\\/?$/.test(location.pathname))return;var saved=JSON.parse(localStorage.getItem(${JSON.stringify(OFFLINE_GAME_KEY)})||"null");if(saved&&saved.state&&saved.state.gameOver===false)document.documentElement.setAttribute(${JSON.stringify(OFFLINE_RESTORE_ATTRIBUTE)},"")}catch(e){}})()`

/** Lifts the flag: the game is back, or there was nothing to bring back. */
export function clearOfflineRestoreFlag(): void {
  document.documentElement.removeAttribute(OFFLINE_RESTORE_ATTRIBUTE)
}
