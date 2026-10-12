import type { SocialImage } from "@/routing/page-head"
import { BRAND } from "@/utils/brand"

/**
 * The words and picture an invite link unfurls with, written once.
 *
 * Two places read it: the route's own head (`pages/invite-link.page.tsx`), for
 * the tab and a share sheet, and the game Worker (`src/server/invite-page.ts`),
 * for the chat apps that never run the page. One source, so the tab and the
 * preview never disagree.
 */
export type InviteCard = {
  /** The whole title, brand included. */
  title: string
  description: string
  image: SocialImage
}

/**
 * The card for a link. A name only while the link is open: a spent or unknown
 * link says nothing about who sent it.
 */
export function inviteCard(openInviterName: string | null): InviteCard {
  if (!openInviterName) {
    return {
      title: `Invite · ${BRAND}`,
      description: `An invite to a game of ${BRAND}, the two-player strategy game of pushing marbles off the board.`,
      image: "home",
    }
  }
  return {
    title: `${openInviterName} invited you to a game of ${BRAND}`,
    description: `Accept and play ${openInviterName} online. ${BRAND} is the two-player strategy game where you push six of your opponent's marbles off the board.`,
    image: "game",
  }
}
