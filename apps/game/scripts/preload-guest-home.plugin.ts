import { resolve } from "node:path"
import type { Plugin } from "vite"

type PreloadGuestHomeOptions = {
  /** The component that sends a guest home, relative to the app root. */
  guard: string
  /** The route files home renders through, relative to the app root. */
  home: string[]
}

/** A module id without the query a plugin may add (`?tsr-split=component`). */
function withoutQuery(moduleId: string): string {
  return moduleId.split("?")[0] ?? moduleId
}

/**
 * Lists home's chunks in the `imports` of every chunk that uses the guard, so a
 * signed-in-only page preloads what a guest is about to be shown.
 *
 * The worker cannot see the bearer token, so it serves a signed-in-only page to
 * everybody, and the guard sends a guest home on the first client render. Home's
 * chunks were then found only after hydration, one more round trip: about 0.6 s
 * of `/online`'s Speed Index on a throttled phone.
 *
 * Only the metadata changes, never the code. It runs before
 * `hoistChunkImports`, which adds everything home's chunks import in turn.
 */
export function preloadGuestHome(
  options: PreloadGuestHomeOptions,
): Plugin {
  let guardId = ""
  let homeIds = new Set<string>()

  return {
    name: "abalone:preload-guest-home",
    apply: "build",
    applyToEnvironment: (environment) => environment.name === "client",
    configResolved(config) {
      guardId = resolve(config.root, options.guard)
      homeIds = new Set(
        options.home.map((file) => resolve(config.root, file)),
      )
    },
    generateBundle(_options, bundle) {
      const homeChunks: string[] = []
      const guardedChunks: { fileName: string; imports: string[] }[] = []

      for (const output of Object.values(bundle)) {
        if (output.type !== "chunk") continue
        const moduleIds = output.moduleIds.map(withoutQuery)
        if (moduleIds.some((moduleId) => homeIds.has(moduleId))) {
          homeChunks.push(output.fileName)
        }
        const usesGuard = output.moduleIds.some((moduleId) =>
          this.getModuleInfo(moduleId)?.importedIds.includes(guardId),
        )
        if (usesGuard) guardedChunks.push(output)
      }

      if (homeChunks.length === 0 || guardedChunks.length === 0) {
        this.error(
          `found ${homeChunks.length} home and ${guardedChunks.length} guarded chunks; has a route file moved?`,
        )
      }

      for (const chunk of guardedChunks) {
        const missing = homeChunks.filter(
          (fileName) =>
            fileName !== chunk.fileName &&
            !chunk.imports.includes(fileName),
        )
        chunk.imports = [...chunk.imports, ...missing]
      }
    },
  }
}
