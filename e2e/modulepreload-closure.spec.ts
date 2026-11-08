import type { APIRequestContext } from "@playwright/test"
import { expect, test } from "@playwright/test"

// Every module a page needs before it can hydrate is preloaded by its HTML.
// A static import the HTML does not preload is found only once the chunk
// importing it has arrived and been parsed, which costs a round trip. On
// /online the client hydrated about 3 s after its entry arrived on a throttled
// phone: i18next and the English strings, then the header's settings sheet,
// were each found a round trip late. Raw HTTP, so it runs once, under chromium.

test.skip(
  ({ browserName }) => browserName !== "chromium",
  "raw HTTP checks: one browser is enough",
)

function modulepreloadPaths(html: string): string[] {
  return [...html.matchAll(/<link[^>]*rel="modulepreload"[^>]*>/g)].map(
    (match) => {
      const href = match[0].match(/href="([^"]+)"/)?.[1]
      if (!href) throw new Error(`modulepreload without href: ${match[0]}`)
      return new URL(href, "http://host").pathname
    },
  )
}

function entryScriptPath(html: string): string {
  const src = html.match(
    /<script[^>]*type="module"[^>]*src="([^"]+)"/,
  )?.[1]
  if (!src) throw new Error("no module script in the page")
  return new URL(src, "http://host").pathname
}

// `import{a}from"./x.js"`, `import"./x.js"` and `export{a}from"./x.js"`, as
// the bundler writes them. Dynamic `import("./x.js")` is left out: those load
// on demand, and their own preloads come with them.
function staticImportPaths(chunkPath: string, code: string): string[] {
  const specifiers = [
    ...code.matchAll(/(?:\bfrom|\bimport)\s*"(\.\/[^"]+\.js)"/g),
  ].map((match) => match[1])
  return specifiers.map(
    (specifier) => new URL(specifier, `http://host${chunkPath}`).pathname,
  )
}

async function unpreloadedStaticImports(
  request: APIRequestContext,
  path: string,
): Promise<string[]> {
  const response = await request.get(path)
  expect(response.status()).toBe(200)
  const html = await response.text()

  const preloaded = new Set(modulepreloadPaths(html))
  preloaded.add(entryScriptPath(html))

  const missing = new Set<string>()
  for (const chunkPath of preloaded) {
    const chunk = await request.get(chunkPath)
    expect(chunk.status(), chunkPath).toBe(200)
    for (const imported of staticImportPaths(
      chunkPath,
      await chunk.text(),
    )) {
      if (!preloaded.has(imported)) missing.add(imported)
    }
  }
  return [...missing].sort()
}

for (const path of ["/", "/online"]) {
  test(`${path} preloads every module its preloads import`, async ({
    request,
  }) => {
    expect(await unpreloadedStaticImports(request, path)).toEqual([])
  })
}
