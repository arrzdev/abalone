/**
 * The card an invite link unfurls into, written into the HTML at request time.
 *
 * Chat apps build a link preview from the raw HTML and never run JavaScript, so
 * the route's own head (`pages/invite-link.page.tsx`) reaches them only when the
 * server already knows who sent the link. The game Worker's entry
 * (`src/server.ts`) asks the backend's public read for it and hands the answer
 * here. Design: `docs/invite-links.md`, "The link preview".
 */

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

/** The token in `/invite/<43-char token>`, or `null` for any other path. */
export function inviteLinkIdFromPath(_pathname: string): string | null {
  //TODO(TUD-799): not built yet, the tests in invite-page.test.ts say what it does
  return null
}

/**
 * The shell with the invite's card in its head, never cached per token.
 */
export async function serveInvitePage(
  options: ServeInvitePageOptions,
): Promise<Response> {
  //TODO(TUD-799): not built yet, the tests in invite-page.test.ts say what it does
  return options.shell
}
