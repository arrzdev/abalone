import type { APIRequestContext } from "@playwright/test"
import { expect, test } from "./support/test"

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

async function modulepreloadsOf(
  request: APIRequestContext,
  path: string,
): Promise<string[]> {
  const response = await request.get(path)
  expect(response.status()).toBe(200)
  return modulepreloadPaths(await response.text())
}

// The worker cannot see the bearer token, so a signed-in-only page is served
// to guests too, and the client sends a guest home on its first render. Home's
// chunks then cost one more round trip after hydration: about 0.6 s of
// /online's Speed Index on a throttled phone. Preloaded with the page, home
// renders as soon as the guest gets there.
for (const path of [
  "/online",
  "/online/history",
  "/online/a-game",
  "/profile",
]) {
  test(`${path} preloads what home needs for a guest`, async ({
    request,
  }) => {
    const preloaded = new Set(await modulepreloadsOf(request, path))
    const missing = (await modulepreloadsOf(request, "/")).filter(
      (homePath) => !preloaded.has(homePath),
    )
    expect(missing).toEqual([])
  })
}

// The page's CSS is inlined in its HTML. A chunk that still names the
// stylesheet makes the bundler's preload helper add it as a <link> when the
// chunk lazy-loads a route, and React holds the render until it arrives. On
// /online that was one more round trip before a guest was sent home.
for (const path of [
  "/",
  "/online",
  "/online/history",
  "/online/a-game",
  "/profile",
]) {
  test(`${path} preloads no chunk that asks for a stylesheet`, async ({
    request,
  }) => {
    const askingForStylesheet: string[] = []
    for (const chunkPath of await modulepreloadsOf(request, path)) {
      const chunk = await request.get(chunkPath)
      expect(chunk.status(), chunkPath).toBe(200)
      if (/"[^"]*\.css"/.test(await chunk.text())) {
        askingForStylesheet.push(chunkPath)
      }
    }
    expect(askingForStylesheet).toEqual([])
  })
}

// zod validates config at build time (`check:env`); the browser builds no
// schema, so its schema classes (22 KB gz) only delayed hydration. What stays
// is `z.config` from utils/zod-jitless, a few hundred bytes. Every zod schema
// class is built through `$constructor("ZodObject", ...)` and kin, so the name
// is in any chunk that ships them, minified or not.
for (const path of ["/", "/online", "/profile"]) {
  test(`${path} preloads no zod schema code`, async ({ request }) => {
    const shippingSchemas: string[] = []
    for (const chunkPath of await modulepreloadsOf(request, path)) {
      const chunk = await request.get(chunkPath)
      expect(chunk.status(), chunkPath).toBe(200)
      if ((await chunk.text()).includes("ZodObject")) {
        shippingSchemas.push(chunkPath)
      }
    }
    expect(shippingSchemas).toEqual([])
  })
}

// The realtime socket library loads on a signed-in player's first connect.
// A guest never opens a channel, so preloading it only delayed hydration.
// `minUptime` is one of its own options, in no file of ours.
for (const path of ["/", "/online", "/profile"]) {
  test(`${path} preloads no realtime socket library`, async ({
    request,
  }) => {
    const shippingSocket: string[] = []
    for (const chunkPath of await modulepreloadsOf(request, path)) {
      const chunk = await request.get(chunkPath)
      expect(chunk.status(), chunkPath).toBe(200)
      if ((await chunk.text()).includes("minUptime")) {
        shippingSocket.push(chunkPath)
      }
    }
    expect(shippingSocket).toEqual([])
  })
}

// The auth SDK loads on first use: the session subscription after the first
// render, or a sign-in, sign-up or sign-out. The first render reads only the
// stored token, so preloading it only delayed hydration. `$sessionSignal` is
// better-auth's own session store key, in no file of ours.
for (const path of ["/", "/online", "/profile"]) {
  test(`${path} preloads no auth SDK`, async ({ request }) => {
    const shippingAuthSdk: string[] = []
    for (const chunkPath of await modulepreloadsOf(request, path)) {
      const chunk = await request.get(chunkPath)
      expect(chunk.status(), chunkPath).toBe(200)
      if ((await chunk.text()).includes("$sessionSignal")) {
        shippingAuthSdk.push(chunkPath)
      }
    }
    expect(shippingAuthSdk).toEqual([])
  })
}
