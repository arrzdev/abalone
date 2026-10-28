import { fileURLToPath } from "node:url"
import type { Plugin } from "vite"
import { runnerImport } from "vite"

/**
 * Writes the files crawlers read into the client assets: `sitemap.xml`
 * (`src/routing/sitemap.ts`) and `llms.txt`.
 *
 * The table lives in the app and imports through the `@/` alias, which the
 * config bundler does not resolve; `runnerImport` loads it through Vite itself,
 * so both files read the same tables the route heads do instead of a copy.
 */

const APP_ROOT = fileURLToPath(new URL("..", import.meta.url))
const SITEMAP_MODULE = fileURLToPath(
  new URL("../src/routing/sitemap.ts", import.meta.url),
)
const LLMS_TXT_MODULE = fileURLToPath(
  new URL("../src/routing/llms-txt.ts", import.meta.url),
)

type SitemapModule = typeof import("@/routing/sitemap")
type LlmsTxtModule = typeof import("@/routing/llms-txt")

const RUNNER_CONFIG = {
  configFile: false,
  root: APP_ROOT,
  logLevel: "error",
  resolve: { tsconfigPaths: true },
} as const

export function crawlerFiles(): Plugin {
  return {
    name: "abalone:crawler-files",
    apply: "build",
    applyToEnvironment: (environment) => environment.name === "client",
    async generateBundle() {
      const [{ module: sitemap }, { module: llms }] = await Promise.all([
        runnerImport<SitemapModule>(SITEMAP_MODULE, RUNNER_CONFIG),
        runnerImport<LlmsTxtModule>(LLMS_TXT_MODULE, RUNNER_CONFIG),
      ])
      this.emitFile({
        type: "asset",
        fileName: "sitemap.xml",
        source: sitemap.sitemapXml(),
      })
      this.emitFile({
        type: "asset",
        fileName: "llms.txt",
        source: llms.llmsTxt(),
      })
    },
  }
}
