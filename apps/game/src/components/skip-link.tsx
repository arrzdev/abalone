import type { MouseEvent } from "react"
import { useTranslation } from "react-i18next"

/** The id of the `<main>` every layout renders its page into. */
export const MAIN_CONTENT_ID = "content"

/**
 * The first Tab stop on every page: "Skip to content", past the header.
 *
 * Hidden until it has focus, then drawn over the top-left corner of the header,
 * where the eye already is when a page has just loaded.
 *
 * It moves focus itself rather than following the hash. A hash would add
 * `#content` to the address and a history entry the back button would then
 * spend a press undoing. The `href` stays for the moment before hydration.
 *
 * The target `<main>` needs `tabIndex={-1}`: without it, focus has nowhere to
 * land and the next Tab starts from the top of the page again.
 */
export function SkipLink() {
  const { t } = useTranslation()

  function skipToContent(event: MouseEvent<HTMLAnchorElement>) {
    const main = document.getElementById(MAIN_CONTENT_ID)
    if (main === null) return
    event.preventDefault()
    main.focus()
  }

  return (
    <a
      href={`#${MAIN_CONTENT_ID}`}
      onClick={skipToContent}
      className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-[10px] focus:bg-surface-3 focus:px-4 focus:py-2.5 focus:font-display focus:text-[15px] focus:font-semibold focus:text-white"
    >
      {t("common:nav.skip_to_content")}
    </a>
  )
}
