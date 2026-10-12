// @vitest-environment node
import { describe, expect, it } from "vitest"
import type { InviteLinkSummary } from "@/server/invite-page"
import {
  inviteLinkIdFromPath,
  serveInvitePage,
} from "@/server/invite-page"

//an invite link's token: 32 random bytes, base64url
const LINK_ID = "Zq3_x-9bT2mK7vR1wY4nP8sL0cF6hJ5dA2eG9uB3oXk"
const PATH = `/invite/${LINK_ID}`

const OPEN_TITLE = "marta invited you to a game of Abalone"
const OPEN_DESCRIPTION =
  "Accept and play marta online. Abalone is the two-player strategy game where you push six of your opponent's marbles off the board."
const GENERIC_TITLE = "Invite · Abalone"
const GENERIC_DESCRIPTION =
  "An invite to a game of Abalone, the two-player strategy game of pushing marbles off the board."

//the head the app serves for an invite path today, trimmed to the tags a
//preview reads: the route's no-name head over the root's card
const SHELL_HTML = `<!DOCTYPE html><html lang="en"><head><meta charSet="utf-8"/><title>${GENERIC_TITLE}</title><meta property="og:type" content="website"/><meta name="twitter:card" content="summary_large_image"/><meta name="description" content="${GENERIC_DESCRIPTION}"/><meta property="og:title" content="${GENERIC_TITLE}"/><meta property="og:description" content="${GENERIC_DESCRIPTION}"/><meta property="og:url" content="https://abalone.tudu.dev${PATH}"/><meta property="og:image" content="https://abalone.tudu.dev/images/social/og-home.jpg"/><meta name="twitter:title" content="${GENERIC_TITLE}"/><meta name="twitter:description" content="${GENERIC_DESCRIPTION}"/><meta name="twitter:image" content="https://abalone.tudu.dev/images/social/og-home.jpg"/><meta name="robots" content="noindex"/></head><body><div id="root"></div><script type="module" src="/assets/main.js"></script></body></html>`

function shell(): Response {
  return new Response(SHELL_HTML, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  })
}

async function serve(
  readLink: (linkId: string) => Promise<InviteLinkSummary | null>,
) {
  const response = await serveInvitePage({
    linkId: LINK_ID,
    shell: shell(),
    readLink,
  })
  return { response, html: await response.text() }
}

/** Every value a tag with this `property` or `name` carries, in order. */
function metaValues(html: string, key: string): string[] {
  const tags = html.match(/<meta\b[^>]*>/g) ?? []
  return tags
    .filter((tag) => new RegExp(`(?:property|name)="${key}"`).test(tag))
    .map((tag) => tag.match(/content="([^"]*)"/)?.[1] ?? "")
}

/** The one value of a tag, failing when it is missing or written twice. */
function meta(html: string, key: string): string {
  const values = metaValues(html, key)
  expect(values, `exactly one ${key}`).toHaveLength(1)
  return values[0]
}

function title(html: string): string | undefined {
  return html.match(/<title>([^<]*)<\/title>/)?.[1]
}

/** What a person reads on the card: none of it may carry the token. */
function cardText(html: string): string[] {
  return [
    title(html) ?? "",
    meta(html, "description"),
    meta(html, "og:title"),
    meta(html, "og:description"),
    meta(html, "twitter:title"),
    meta(html, "twitter:description"),
  ]
}

function expectGenericCard(html: string) {
  expect(title(html)).toBe(GENERIC_TITLE)
  expect(meta(html, "og:title")).toBe(GENERIC_TITLE)
  expect(meta(html, "twitter:title")).toBe(GENERIC_TITLE)
  expect(meta(html, "og:description")).toBe(GENERIC_DESCRIPTION)
  expect(meta(html, "twitter:description")).toBe(GENERIC_DESCRIPTION)
  expect(meta(html, "og:image")).toBe(
    "https://abalone.tudu.dev/images/social/og-home.jpg",
  )
  expect(meta(html, "twitter:card")).toBe("summary_large_image")
  for (const text of cardText(html)) {
    expect(text).not.toContain("marta")
    expect(text).not.toContain(LINK_ID)
  }
}

describe("serveInvitePage", () => {
  it("names the inviter on an open link", async () => {
    const { response, html } = await serve(async () => ({
      inviterName: "marta",
      state: "open",
    }))

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toContain("text/html")
    expect(title(html)).toBe(OPEN_TITLE)
    expect(meta(html, "og:title")).toBe(OPEN_TITLE)
    expect(meta(html, "twitter:title")).toBe(OPEN_TITLE)
    expect(meta(html, "description")).toBe(OPEN_DESCRIPTION)
    expect(meta(html, "og:description")).toBe(OPEN_DESCRIPTION)
    expect(meta(html, "twitter:description")).toBe(OPEN_DESCRIPTION)
    //one fixed picture for every link: no image is made per link
    expect(meta(html, "og:image")).toBe(
      "https://abalone.tudu.dev/images/social/og-game.jpg",
    )
    expect(meta(html, "twitter:image")).toBe(
      "https://abalone.tudu.dev/images/social/og-game.jpg",
    )
    expect(meta(html, "twitter:card")).toBe("summary_large_image")
    expect(meta(html, "robots")).toBe("noindex")
    for (const text of cardText(html)) expect(text).not.toContain(LINK_ID)
  })

  //a spent link says nothing about who sent it
  it("gives a used link the generic card", async () => {
    const { html } = await serve(async () => ({
      inviterName: "marta",
      state: "used",
    }))
    expectGenericCard(html)
  })

  it("gives an expired link the generic card", async () => {
    const { html } = await serve(async () => ({
      inviterName: "marta",
      state: "expired",
    }))
    expectGenericCard(html)
  })

  it("gives an unknown link the generic card", async () => {
    const { response, html } = await serve(async () => null)
    expect(response.status).toBe(200)
    expectGenericCard(html)
  })

  //the backend down or slow is no reason to fail the page: the app still loads
  //and says what it can
  it("gives the generic card when the read fails", async () => {
    const { response, html } = await serve(async () => {
      throw new Error("backend unreachable")
    })
    expect(response.status).toBe(200)
    expectGenericCard(html)
  })

  //the answer depends on the link's state, which changes when someone accepts:
  //an edge or a browser keeping it would show the name on a used link
  it.each([
    ["open", { inviterName: "marta", state: "open" as const }],
    ["used", { inviterName: "marta", state: "used" as const }],
    ["expired", { inviterName: "marta", state: "expired" as const }],
    ["unknown", null],
  ])("is never cached for a %s link", async (_state, summary) => {
    const { response } = await serve(async () => summary)
    const cacheControl = response.headers.get("cache-control") ?? ""
    expect(cacheControl).toContain("private")
    expect(cacheControl).toContain("no-store")
  })

  //a display name is whatever the player typed: it goes into an attribute, so
  //it is escaped, never written as markup
  it("escapes the inviter's name", async () => {
    const { html } = await serve(async () => ({
      inviterName: `ana"><script>x</script>&co`,
      state: "open",
    }))
    expect(html).not.toContain("<script>x</script>")
    expect(meta(html, "og:title")).toBe(
      "ana&quot;&gt;&lt;script&gt;x&lt;/script&gt;&amp;co invited you to a game of Abalone",
    )
  })

  it("keeps the rest of the page as the app served it", async () => {
    const { html } = await serve(async () => ({
      inviterName: "marta",
      state: "open",
    }))
    expect(html).toContain(
      '<script type="module" src="/assets/main.js"></script>',
    )
    expect(meta(html, "og:url")).toBe(`https://abalone.tudu.dev${PATH}`)
  })
})

describe("inviteLinkIdFromPath", () => {
  it("reads the token from an invite path", () => {
    expect(inviteLinkIdFromPath(PATH)).toBe(LINK_ID)
  })

  it("ignores every other path", () => {
    expect(inviteLinkIdFromPath("/")).toBeNull()
    expect(inviteLinkIdFromPath("/invite")).toBeNull()
    expect(inviteLinkIdFromPath("/invite/short")).toBeNull()
    expect(inviteLinkIdFromPath(`${PATH}/more`)).toBeNull()
    expect(inviteLinkIdFromPath(`/online/${LINK_ID}`)).toBeNull()
  })
})
