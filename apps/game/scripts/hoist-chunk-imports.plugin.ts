import type { Plugin } from "vite"

type ChunkImports = { imports: string[] }

/**
 * Every chunk a chunk statically imports, directly or through another one,
 * nearest first. A chunk missing from the bundle (an external) ends the walk
 * there.
 */
function transitiveImports(
  fileName: string,
  chunks: ReadonlyMap<string, ChunkImports>,
): string[] {
  const found: string[] = []
  const seen = new Set([fileName])
  const queue = [fileName]

  while (queue.length > 0) {
    const current = chunks.get(queue.shift() ?? "")
    if (!current) continue
    for (const imported of current.imports) {
      if (seen.has(imported)) continue
      seen.add(imported)
      found.push(imported)
      queue.push(imported)
    }
  }
  return found
}

/**
 * Lists in each client chunk's `imports` every chunk it needs before it can
 * run, not only the ones it names.
 *
 * Start preloads a route's chunk and that chunk's `imports`, one level deep
 * (`start-plugin-core` manifestBuilder). Rollup hoists transitive imports into
 * that list; Rolldown leaves some out. On `/online` that left i18next, the
 * English strings and the header's settings sheet unpreloaded, so the browser
 * found each one only after the chunk importing it had arrived, and hydration
 * waited about three extra round trips on a phone.
 *
 * Only the metadata changes, never the code. It runs before Start reads the
 * bundle, which is `enforce: "post"`.
 */
export function hoistChunkImports(): Plugin {
  return {
    name: "abalone:hoist-chunk-imports",
    apply: "build",
    applyToEnvironment: (environment) => environment.name === "client",
    generateBundle(_options, bundle) {
      const chunks = new Map<string, ChunkImports>()
      for (const output of Object.values(bundle)) {
        if (output.type === "chunk") chunks.set(output.fileName, output)
      }

      const hoisted = new Map<string, string[]>()
      for (const fileName of chunks.keys()) {
        hoisted.set(fileName, transitiveImports(fileName, chunks))
      }
      for (const [fileName, imports] of hoisted) {
        const chunk = chunks.get(fileName)
        if (chunk) chunk.imports = imports
      }
    },
  }
}
