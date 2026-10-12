/**
 * The card an invite link unfurls into, written into the HTML at request time.
 *
 * Chat apps build a link preview from the raw HTML and never run JavaScript, so
 * the route's own head (`pages/invite-link.page.tsx`) reaches them only when the
 * server already knows who sent the link. The game Worker's entry
 * (`src/server.ts`) asks the backend's public read for it and hands the answer
 * here. Design: `docs/invite-links.md`, "The link preview".
 */

import tryCatch from "@repo/shared/try-catch"
import { inviteCard } from "@/routing/invite-card"
import { siteUrl } from "@/utils/site"

/** What `GET /api/v1/invite-links/:id` answers for a link that exists. */
export type InviteLinkSummary = {
  inviterName: string
  state: "open" | "used" | "expired"
}

export type ServeInvitePageOptions = {
  /** The link's token, from the path. */
  linkId: string
  /** What the app serves for this path without a card: the shell. */
  shell: Response
  /** The public read. `null` for an unknown link; may throw when unreachable. */
  readLink: (linkId: string) => Promise<InviteLinkSummary | null>
}

//32 random bytes, base64url, no padding
const INVITE_PATH = /^\/invite\/([A-Za-z0-9_-]{43})$/

/** The token in `/invite/<43-char token>`, or `null` for any other path. */
export function inviteLinkIdFromPath(pathname: string): string | null {
  return INVITE_PATH.exec(pathname)?.[1] ?? null
}

/**
 * The shell with the invite's card in its head, never cached per token.
 */
export async function serveInvitePage(
  options: ServeInvitePageOptions,
): Promise<Response> {
  const [summary, html] = await Promise.all([
    readOpenInviterName(options),
    options.shell.text(),
  ])
  const card = inviteCard(summary)
  const image = siteUrl(`/images/social/og-${card.image}.jpg`)

  const tags: Array<[key: string, attribute: string, value: string]> = [
    ["description", "name", card.description],
    ["og:title", "property", card.title],
    ["og:description", "property", card.description],
    ["og:image", "property", image],
    ["twitter:title", "name", card.title],
    ["twitter:description", "name", card.description],
    ["twitter:image", "name", image],
  ]
  let page = replaceTitle(html, card.title)
  for (const [key, attribute, value] of tags) {
    page = replaceMeta(page, key, attribute, value)
  }

  const headers = new Headers(options.shell.headers)
  headers.set("cache-control", "private, no-store")
  //the body changed length
  headers.delete("content-length")

  return new Response(page, {
    status: options.shell.status,
    statusText: options.shell.statusText,
    headers,
  })
}

/** The sender's name when the link is open; `null` for anything else. */
async function readOpenInviterName(
  options: ServeInvitePageOptions,
): Promise<string | null> {
  const [summary, error] = await tryCatch(() =>
    options.readLink(options.linkId),
  )
  if (error || summary?.state !== "open") return null
  return summary.inviterName
}

//every attribute written here is double-quoted, so an apostrophe stays as is
function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

function replaceTitle(html: string, title: string): string {
  const tag = `<title>${escapeHtml(title)}</title>`
  const titles = /<title\b[^>]*>[^<]*<\/title>/g
  return writeOnce(html, titles, tag)
}

/** The one tag for this key, in place of every copy the page had. */
function replaceMeta(
  html: string,
  key: string,
  attribute: string,
  value: string,
): string {
  const tag = `<meta ${attribute}="${key}" content="${escapeHtml(value)}"/>`
  const tags = new RegExp(
    `<meta\\b[^>]*\\b(?:property|name)="${key}"[^>]*>`,
    "g",
  )
  return writeOnce(html, tags, tag)
}

/**
 * The first match swapped for `tag`, the rest dropped; with no match, `tag` at
 * the end of the head.
 */
function writeOnce(html: string, pattern: RegExp, tag: string): string {
  let isWritten = false
  const replaced = html.replace(pattern, () => {
    if (isWritten) return ""
    isWritten = true
    return tag
  })
  if (isWritten) return replaced
  return html.replace("</head>", `${tag}</head>`)
}
