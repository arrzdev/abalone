import { fileURLToPath } from "node:url"
import type { Plugin } from "vite"
import { runnerImport } from "vite"

/**
 * Writes `sitemap.xml` into the client assets, one entry per page in
 * `SEO_PAGES`, dated the day of the build.
 *
 * The table lives in the app and imports through the `@/` alias, which the
 * config bundler does not resolve; `runnerImport` loads it through Vite itself,
 * so the sitemap reads the same table the route heads do instead of a copy.
 */

//the same origin as `SITE_ORIGIN` in src/utils/site.ts; spelled again for the
//same reason nativ.config.ts spells it: this runs outside the app's aliases
const SITE_ORIGIN = "https://abalone.tudu.dev"

const APP_ROOT = fileURLToPath(new URL("..", import.meta.url))
const SEO_PAGES_MODULE = fileURLToPath(
  new URL("../src/routing/seo-pages.ts", import.meta.url),
)

type SeoPagesModule = typeof import("@/routing/seo-pages")

function sitemapXml(paths: string[], lastmod: string): string {
  const entries = paths.map(
    (path) =>
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

export function sitemap(): Plugin {
  return {
    name: "abalone:sitemap",
    apply: "build",
    applyToEnvironment: (environment) => environment.name === "client",
    async generateBundle() {
      const { module } = await runnerImport<SeoPagesModule>(
        SEO_PAGES_MODULE,
        {
          configFile: false,
          root: APP_ROOT,
          logLevel: "error",
          resolve: { tsconfigPaths: true },
        },
      )
      const lastmod = new Date().toISOString().slice(0, 10)

      this.emitFile({
        type: "asset",
        fileName: "sitemap.xml",
        source: sitemapXml(Object.keys(module.SEO_PAGES), lastmod),
      })
    },
  }
}
