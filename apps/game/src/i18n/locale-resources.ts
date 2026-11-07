import type { ResourceKey } from "i18next"
import type { Language } from "@/i18n/languages"

export const NAMESPACES = [
  "common",
  "game",
  "bots",
  "errors",
  "online",
] as const

type ResourceModules = Record<string, ResourceKey>
type ResourceLoaders = Record<string, () => Promise<ResourceKey>>

/**
 * The translations a page has in hand, and how to fetch the rest.
 *
 * `eager` is every file already in memory: all of them on the server and in
 * tests, none in the browser. `lazy` fetches one file on demand, which the
 * build turns into one chunk per language and namespace. Keys are the glob's
 * paths (`./locales/de/common.json`).
 *
 * A language is loaded as a whole (its five namespaces) and at most once, so
 * a second call, or two at the same time, share the first one's promise.
 */
export function createLocaleResources(sources: {
  eager: ResourceModules
  lazy: ResourceLoaders
}) {
  const bundles = new Map<string, ResourceKey>()
  const loading = new Map<Language, Promise<void>>()

  for (const [path, resource] of Object.entries(sources.eager)) {
    const match = path.match(/\/locales\/([^/]+)\/([^/]+)\.json$/)
    if (match) bundles.set(`${match[1]}/${match[2]}`, resource)
  }

  function bundleKey(language: Language, namespace: string): string {
    return `${language}/${namespace}`
  }

  async function fetchNamespace(
    language: Language,
    namespace: string,
  ): Promise<void> {
    const key = bundleKey(language, namespace)
    if (bundles.has(key)) return

    const load = sources.lazy[`./locales/${language}/${namespace}.json`]
    if (!load) return
    bundles.set(key, await load())
  }

  return {
    /** One file's translations, if it is loaded; synchronous, so a route `head` can read it. */
    resource<Shape = ResourceKey>(
      language: Language,
      namespace: string,
    ): Shape | undefined {
      return bundles.get(bundleKey(language, namespace)) as
        | Shape
        | undefined
    },

    isLoaded(language: Language): boolean {
      return NAMESPACES.every((namespace) =>
        bundles.has(bundleKey(language, namespace)),
      )
    },

    /** Fetches a language's files. A failed fetch is forgotten, so the next call tries again. */
    load(language: Language): Promise<void> {
      const existing = loading.get(language)
      if (existing) return existing

      const started = Promise.all(
        NAMESPACES.map((namespace) => fetchNamespace(language, namespace)),
      ).then(() => undefined)
      loading.set(language, started)
      started.catch(() => loading.delete(language))
      return started
    },
  }
}

//the server renders every language from one isolate and has no network to
//fetch from, so it holds them all. tests read any language synchronously too.
//the browser holds none until it asks, which is what keeps them out of the
//entry chunk: the flag is a build-time constant, so the client build drops the
//eager glob and its imports with it.
const holdsEveryLanguage =
  import.meta.env.SSR || import.meta.env.MODE === "test"

const eagerModules = holdsEveryLanguage
  ? import.meta.glob<ResourceKey>("./locales/*/*.json", {
      eager: true,
      import: "default",
    })
  : {}

export const localeResources = createLocaleResources({
  eager: eagerModules,
  lazy: import.meta.glob<ResourceKey>("./locales/*/*.json", {
    import: "default",
  }),
})
