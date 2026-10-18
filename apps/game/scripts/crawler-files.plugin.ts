import { fileURLToPath } from "node:url"
import type { Plugin } from "vite"
import { runnerImport } from "vite"

/**
 * Writes the files crawlers read into the client assets: `sitemap.xml`, one
 * entry per page in `SITEMAP` dated the day that page last changed, and
 * `llms.txt`.
 *
 * The table lives in the app and imports through the `@/` alias, which the
 * config bundler does not resolve; `runnerImport` loads it through Vite itself,
 * so both files read the same table the route heads do instead of a copy.
 */

//the same origin as `SITE_ORIGIN` in src/utils/site.ts; spelled again for the
//same reason nativ.config.ts spells it: this runs outside the app's aliases
const SITE_ORIGIN = "https://abalone.tudu.dev"

const APP_ROOT = fileURLToPath(new URL("..", import.meta.url))
const SEO_PAGES_MODULE = fileURLToPath(
  new URL("../src/routing/seo-pages.ts", import.meta.url),
)
const LLMS_TXT_MODULE = fileURLToPath(
  new URL("../src/routing/llms-txt.ts", import.meta.url),
)

type SeoPagesModule = typeof import("@/routing/seo-pages")
type LlmsTxtModule = typeof import("@/routing/llms-txt")

const RUNNER_CONFIG = {
  configFile: false,
  root: APP_ROOT,
  logLevel: "error",
  resolve: { tsconfigPaths: true },
} as const

function sitemapXml(pages: Record<string, string>): string {
  const entries = Object.entries(pages).map(
    ([path, lastmod]) =>
      `  <url>\n    <loc>${SITE_ORIGIN}${path}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`,
  )
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...entries,
    `</urlset>`,
    "",
  ].join("\n")
}

export function crawlerFiles(): Plugin {
  return {
    name: "abalone:crawler-files",
    apply: "build",
    applyToEnvironment: (environment) => environment.name === "client",
    async generateBundle() {
      const [{ module: seoPages }, { module: llms }] = await Promise.all([
        runnerImport<SeoPagesModule>(SEO_PAGES_MODULE, RUNNER_CONFIG),
        runnerImport<LlmsTxtModule>(LLMS_TXT_MODULE, RUNNER_CONFIG),
      ])
      this.emitFile({
        type: "asset",
        fileName: "sitemap.xml",
        source: sitemapXml(seoPages.SITEMAP),
      })
      this.emitFile({
        type: "asset",
        fileName: "llms.txt",
        source: llms.llmsTxt(),
      })
    },
  }
}
