import { useTranslation } from "react-i18next"
import { PlayerLine } from "@/components/online/player-line"
import { Button } from "@/components/ui/button"
import type { Invite } from "@/data/online/queries"
import { getSetupName } from "@/i18n/game-text"

export type InviteRowProps = {
  invite: Invite
  /** Which side of it the player reading this is on. */
  direction: "received" | "sent"
  busy: boolean
  onAccept: (inviteId: string) => void
  onDecline: (inviteId: string) => void
  onRemove: (inviteId: string) => void
}

/**
 * One invite, with whatever the reader can do about it.
 *
 * Three states, and each one offers exactly what it should: an invite you were
 * sent has a yes and a no, one you sent has a way to take it back, and one that
 * was turned down has a way to clear it off the list. The last two are the same
 * request, because both are the row you sent leaving.
 */
export function InviteRow({
  invite,
  direction,
  busy,
  onAccept,
  onDecline,
  onRemove,
}: InviteRowProps) {
  const { t } = useTranslation()

  const other = direction === "received" ? invite.from : invite.to
  const isDeclined = invite.status === "declined"

  //the side named on an invite is the sender's, so a recipient reading it wants
  //the other one — otherwise "black" on your own screen means your opponent
  const side =
    direction === "sent" || invite.side === "random"
      ? invite.side
      : invite.side === "black"
        ? "white"
        : "black"

  const detail = t("online:invites.terms", {
    setup: getSetupName(invite.setupType),
    side: t(`online:sides.${side}`),
  })

  return (
    <div className="flex items-center gap-3 rounded-xl bg-surface-4 px-3 py-2.5">
      <PlayerLine
        player={other}
        detail={isDeclined ? t("online:invites.declined") : detail}
      />

      <div className="flex shrink-0 items-center gap-2">
        {/* nothing to answer once it has been answered: the server only takes
            a yes or a no while the invite is still standing */}
        {direction === "received" && !isDeclined && (
          <>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => onDecline(invite.id)}
            >
              {t("online:invites.decline")}
            </Button>
            <Button
              size="sm"
              variant="primary"
              disabled={busy}
              onClick={() => onAccept(invite.id)}
            >
              {t("online:invites.accept")}
            </Button>
          </>
        )}

        {direction === "sent" && (
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => onRemove(invite.id)}
          >
            {isDeclined
              ? t("online:invites.dismiss")
              : t("online:invites.cancel")}
          </Button>
        )}
      </div>
    </div>
  )
}
