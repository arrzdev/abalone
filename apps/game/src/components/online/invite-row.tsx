import { cn } from "@repo/nativ/utils"
import { useTranslation } from "react-i18next"
import { CloseIcon } from "@/components/icons"
import { Avatar } from "@/components/ui/avatar"
import type { Invite } from "@/data/online/queries"
import { getSetupName } from "@/i18n/game-text"

export type ReceivedInviteRowProps = {
  invite: Invite
  /**
   * Shrink to a single line with the actions at its end. The rail gives one
   * invite the whole width; from two upwards they have to share it.
   */
  dense?: boolean
  busy: boolean
  onAccept: (inviteId: string) => void
  onDecline: (inviteId: string) => void
}

/**
 * The terms of an invite, from the reader's side of the board.
 *
 * The side named on an invite is the sender's, so a recipient reading it wants
 * the other one — otherwise "black" on your own screen means your opponent.
 */
function useInviteTerms(invite: Invite, direction: "received" | "sent") {
  const { t } = useTranslation()

  let side = invite.side
  if (direction === "received" && invite.side === "black") side = "white"
  if (direction === "received" && invite.side === "white") side = "black"

  return t("online:invites.terms", {
    setup: getSetupName(invite.setupType),
    side: t(`online:sides.${side}`),
  })
}

/**
 * An invite somebody sent you, and the two answers to it.
 *
 * One of these gets the full width of the rail, because with one invite the rail
 * is the invite and a yes worth pressing should be the width of the thing it is
 * in. From two upwards that shape costs half the screen to say the same thing
 * twice, so they collapse to a row each: the yes keeps its fill and its word,
 * and the no becomes the cross it always was.
 */
export function ReceivedInviteRow({
  invite,
  dense = false,
  busy,
  onAccept,
  onDecline,
}: ReceivedInviteRowProps) {
  const { t } = useTranslation()
  const terms = useInviteTerms(invite, "received")
  const name = invite.from.displayUsername ?? invite.from.username

  if (dense) {
    return (
      <div className="flex items-center gap-3 py-2.5 ps-4 pe-3 lg:ps-[18px]">
        <Avatar src={invite.from.avatarUrl} name={name} size={36} />

        <span className="block min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold text-white">
            {name}
          </span>
          <span className="mt-px block truncate text-xs text-faint">
            {terms}
          </span>
        </span>

        <span className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            disabled={busy}
            onClick={() => onAccept(invite.id)}
            className="inline-flex h-[34px] items-center rounded-[9px] bg-brand px-3.5 font-display text-sm font-semibold text-white transition-colors duration-200 ease-out hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-45"
          >
            {t("online:invites.accept")}
          </button>

          <button
            type="button"
            disabled={busy}
            aria-label={t("online:invites.decline")}
            title={t("online:invites.decline")}
            onClick={() => onDecline(invite.id)}
            className="inline-flex size-[34px] items-center justify-center rounded-[9px] text-faint transition-colors duration-200 ease-out hover:bg-surface-3 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-45"
          >
            <CloseIcon size={17} strokeWidth={2.2} />
          </button>
        </span>
      </div>
    )
  }

  return (
    <div className="px-4 pt-3.5 pb-4 lg:px-[18px]">
      <div className="flex items-center gap-3">
        <Avatar src={invite.from.avatarUrl} name={name} size={44} />

        <span className="block min-w-0 flex-1">
          <span className="block truncate text-base font-semibold text-white">
            {name}
          </span>
          <span className="mt-0.5 block truncate text-[13px] text-faint">
            {terms}
          </span>
        </span>
      </div>

      <div className="mt-3.5 flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => onAccept(invite.id)}
          className="inline-flex h-[42px] flex-1 items-center justify-center rounded-[10px] bg-brand font-display text-[15px] font-semibold text-white transition-colors duration-200 ease-out hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-45"
        >
          {t("online:invites.accept")}
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={() => onDecline(invite.id)}
          className="inline-flex h-[42px] items-center justify-center rounded-[10px] px-4 font-display text-[15px] font-semibold text-muted transition-colors duration-200 ease-out hover:bg-surface-2 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-45"
        >
          {t("online:invites.decline")}
        </button>
      </div>
    </div>
  )
}

export type SentInviteRowProps = {
  invite: Invite
  busy: boolean
  onRemove: (inviteId: string) => void
}

/**
 * How long an invite still reads as "just sent".
 *
 * Long enough to still be there after the redirect back to the lobby and a
 * glance at it, short enough that it is gone by the next visit. Sending is the
 * one action here with nothing to show for it — no game row appears, because
 * there is no game until they say yes — so this line is the receipt.
 */
const JUST_SENT_MS = 90_000

/**
 * An invite you sent, waiting or turned down.
 *
 * Quieter than a received one, and with one action rather than two: there is no
 * decision here, only a row to take back or clear away. Both are the same
 * request — the row you sent leaving.
 */
export function SentInviteRow({
  invite,
  busy,
  onRemove,
}: SentInviteRowProps) {
  const { t } = useTranslation()
  const terms = useInviteTerms(invite, "sent")
  const name = invite.to.displayUsername ?? invite.to.username
  const isDeclined = invite.status === "declined"
  const isJustSent =
    !isDeclined && Date.now() - invite.createdAt < JUST_SENT_MS

  return (
    <div className="flex items-center gap-3 px-4 pt-0.5 pb-3 lg:px-[18px]">
      <Avatar src={invite.to.avatarUrl} name={name} size={32} />

      <span className="block min-w-0 flex-1">
        <span
          className={cn(
            "block truncate text-sm font-semibold",
            isJustSent ? "text-white" : "text-subtle",
          )}
        >
          {name}
        </span>
        <span
          className={cn(
            "block truncate text-xs",
            isDeclined && "text-loss",
            isJustSent && "text-brand-lighter",
            !isDeclined && !isJustSent && "text-faint",
          )}
        >
          {isDeclined && t("online:invites.declined")}
          {isJustSent && t("online:invites.just_sent")}
          {!isDeclined && !isJustSent && terms}
        </span>
      </span>

      <button
        type="button"
        disabled={busy}
        onClick={() => onRemove(invite.id)}
        className="inline-flex h-[34px] shrink-0 items-center rounded-[9px] px-3 font-display text-[13px] font-semibold text-faint transition-colors duration-200 ease-out hover:bg-surface-2 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-45"
      >
        {isDeclined
          ? t("online:invites.dismiss")
          : t("online:invites.cancel")}
      </button>
    </div>
  )
}

export type LeadInviteRowProps = {
  invite: Invite
  busy: boolean
  onAccept: (inviteId: string) => void
  onDecline: (inviteId: string) => void
}

/**
 * An invite when answering it is the whole point of the screen.
 *
 * The hub gives this shape to invites only when there is no move to make, so it
 * is the largest thing on the page and both answers are full-size controls. It
 * is one row above `lg` and a card below it, which is the same content laid out
 * for a width that cannot hold a name and two buttons on one line.
 *
 * `lg:contents` is what keeps that from being two components: the buttons stay
 * a row of their own on a phone and become siblings of the name on a desktop,
 * without either shape being written out twice.
 */
export function LeadInviteRow({
  invite,
  busy,
  onAccept,
  onDecline,
}: LeadInviteRowProps) {
  const { t } = useTranslation()
  const terms = useInviteTerms(invite, "received")
  const name = invite.from.displayUsername ?? invite.from.username

  return (
    <div className="flex flex-col rounded-[14px] bg-surface-2 px-[15px] pt-3.5 pb-[15px] lg:h-[92px] lg:flex-row lg:items-center lg:gap-4 lg:rounded-2xl lg:px-5 lg:py-0">
      <div className="flex items-center gap-3 lg:min-w-0 lg:flex-1">
        <Avatar src={invite.from.avatarUrl} name={name} size={44} />

        <span className="block min-w-0 flex-1">
          <span className="block truncate font-display text-[17px] font-semibold text-white lg:text-[19px]">
            {name}
          </span>
          <span className="mt-0.5 block truncate text-xs text-muted lg:text-[13px]">
            {terms}
          </span>
        </span>
      </div>

      <div className="mt-3 flex gap-2 lg:contents">
        <button
          type="button"
          disabled={busy}
          onClick={() => onAccept(invite.id)}
          className="inline-flex h-11 flex-1 shrink-0 items-center justify-center rounded-[11px] bg-brand font-display text-[15px] font-semibold text-white transition-colors duration-200 ease-out hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-45 lg:h-[42px] lg:flex-none lg:px-[22px]"
        >
          {t("online:invites.accept")}
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={() => onDecline(invite.id)}
          className="inline-flex h-11 shrink-0 items-center justify-center rounded-[11px] px-4 font-display text-[15px] font-semibold text-muted transition-colors duration-200 ease-out hover:bg-surface-3 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-45 lg:h-[42px]"
        >
          {t("online:invites.decline")}
        </button>
      </div>
    </div>
  )
}
