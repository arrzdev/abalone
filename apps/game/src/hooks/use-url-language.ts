import { useRouterState } from "@tanstack/react-router"
import type { Language } from "@/i18n/languages"
import { splitLocalePath } from "@/i18n/locale-path"

/**
 * The language of the address the page is on. `publicHref` is the URL as the
 * browser (or the request, on the server) spells it, prefix included; the
 * router's own `pathname` has the prefix taken off.
 */
export function useUrlLanguage(): Language {
  return useRouterState({
    select: (state) =>
      splitLocalePath(state.location.publicHref.split(/[?#]/)[0] ?? "/")
        .language,
  })
}
