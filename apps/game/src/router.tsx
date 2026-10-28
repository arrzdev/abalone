import { standaloneMemoryHistory } from "@repo/nativ/shell"
import { createRouter } from "@tanstack/react-router"
import type { Language } from "@/i18n/languages"
import {
  DEFAULT_LANGUAGE,
  localePath,
  splitLocalePath,
} from "@/i18n/locale-path"
import { routeTree } from "@/routing/routeTree.gen"

/**
 * The router, ejected from nativ's generated one for a single addition: the
 * language prefix (`/pt/rules`) that every URL may carry (`docs/locale-urls.md`).
 *
 * The mechanism is a location rewrite rather than a route segment. The route
 * table, every `<Link to="/rules">` and every `redirect()` keep speaking in
 * unprefixed paths; the prefix is taken off a URL on the way in and put back
 * on the way out, so a link inside the app keeps the language of the page it
 * is on without any call site knowing. The rest of this file is what
 * `router.gen.tsx` would have said (`nativ.config.ts`, `router`).
 *
 * The language of the URL the router last read lives in `context.language`,
 * on this router only: Start builds one router per request, so two requests in
 * one Worker isolate never see each other's. Route `head` functions read it
 * through `routeLanguage` (`@/routing/route-language`).
 */
export function getRouter() {
  const context: { language: Language } = { language: DEFAULT_LANGUAGE }

  return createRouter({
    routeTree,
    context,
    rewrite: {
      input({ url }) {
        const location = splitLocalePath(url.pathname)
        context.language = location.language
        url.pathname = location.path
        return url
      },
      output({ url }) {
        url.pathname = localePath(url.pathname, context.language)
        return url
      },
    },
    history: standaloneMemoryHistory(),
    notFoundMode: "root",
    defaultPreload: "viewport",
    defaultPreloadStaleTime: Number.POSITIVE_INFINITY,
  })
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
