import { cn } from "@repo/nativ/utils"
import { useMutation } from "@tanstack/react-query"
import { useId, useState } from "react"
import { useTranslation } from "react-i18next"
import type { HandOffStatus } from "@/components/online/share-link-button"
import {
  handOffLink,
  ShareLinkButton,
} from "@/components/online/share-link-button"
import { Button } from "@/components/ui/button"
import { Reserved } from "@/components/ui/reserved"
import { StatusLine } from "@/components/ui/status-line"
import { TextField } from "@/components/ui/text-field"
import type { CreateInviteLinkInput } from "@/data/online/mutations"
import { createInviteLinkMutationOptions } from "@/data/online/mutations"
import { useApiError } from "@/hooks/use-api-error"

/** What a request for a link can come back with, for the status line to hold room for. */
const LINK_ERRORS = [
  "errors:api_rate_limit_exceeded",
  "errors:api_service_unavailable",
  "errors:api_internal_server_error",
  "errors:network_unreachable",
  "errors:unknown",
] as const

export type InviteLinkMakerProps = CreateInviteLinkInput & {
  /** Called once the server hands the link back. */
  onCreated?: () => void
  /**
   * The page's first action rather than the composer's second: filled and at
   * the display size, with no heading of its own, and the link handed on the
   * moment it exists, so one tap makes it and shares it.
   */
  lead?: boolean
}

/**
 * The other way to ask: a link instead of a name.
 *
 * It takes the opening and the side the composer already has picked, so it
 * asks nothing of its own. The composer remounts it whenever either of those
 * changes, which is what throws away a link made on the old terms: a link
 * sitting in the field after the board above it changed would be a link to a
 * game nobody is looking at.
 *
 * Nothing here needs the list of sent invites to move. A link is not a row
 * until somebody takes it, and then it is a game.
 *
 * As the lead, the hand-off runs after the request, and WebKit may have let the
 * tap's permission to share or copy lapse by then. That refusal says nothing:
 * the link is on screen with its own button, and a second tap there works.
 */
export function InviteLinkMaker({
  setupType,
  side,
  onCreated,
  lead = false,
}: InviteLinkMakerProps) {
  const { t } = useTranslation()
  const statusId = useId()
  const translateError = useApiError()
  const create = useMutation(createInviteLinkMutationOptions)
  const [status, setStatus] = useState<HandOffStatus>("idle")

  const url = create.data?.url
  const shareText = t("online:link.share_text")

  //as the lead, `min-h` rather than the size's fixed height: the label is three
  //words in English and five in German, and a button that cannot grow spills
  //its second line over its own edges
  const buttonClassName = lead
    ? "h-auto min-h-[54px] py-3 text-balance"
    : ""
  const variant = lead ? "primary" : "outline"
  const size = lead ? "lg" : "md"

  let message: string | undefined
  if (create.error) message = translateError(create.error)
  else if (status === "copied") message = t("online:link.copied")
  else if (status === "failed") message = t("online:link.copy_failed")

  function handleCreate() {
    create.mutate(
      { setupType, side },
      {
        onSuccess: async (link) => {
          onCreated?.()
          if (!lead) return
          const handedOff = await handOffLink(link.url, shareText)
          if (handedOff !== "failed") setStatus(handedOff)
        },
      },
    )
  }

  return (
    <div className="flex flex-col gap-y-2">
      {/* The button and the link it makes share one cell, so the row is the
          height of the taller of the two from the first render, and making a
          link swaps one for the other without moving anything under it. The
          one not in use is `invisible`: there to be measured, not reached. */}
      <Reserved>
        <Button
          variant={variant}
          size={size}
          className={cn("w-full", buttonClassName, url && "invisible")}
          pending={create.isPending}
          aria-describedby={statusId}
          onClick={handleCreate}
        >
          {t("online:link.create")}
        </Button>

        {/* The field ends in an ellipsis where the link is longer than the
            room, and the whole link is still its value, to select or copy. */}
        <div
          className={cn("flex items-center gap-2", !url && "invisible")}
        >
          <TextField
            label={t("online:link.field")}
            hideLabel
            value={url ?? ""}
            readOnly
            tabIndex={url ? undefined : -1}
            onFocus={(event) => event.currentTarget.select()}
            className={cn("text-ellipsis", lead ? "h-[54px]" : "h-11")}
            containerClassName="min-w-0 flex-1"
          />
          <ShareLinkButton
            url={url ?? ""}
            text={shareText}
            onStatusChange={setStatus}
            statusId={statusId}
            variant={variant}
            size={size}
            className="shrink-0"
          />
        </div>
      </Reserved>

      <StatusLine
        id={statusId}
        role="status"
        message={message}
        messageClassName={create.error ? "text-loss" : "text-muted"}
        hint={t("online:link.hint")}
        reserve={[
          t("online:link.copied"),
          t("online:link.copy_failed"),
          ...LINK_ERRORS.map((key) => t(key)),
        ]}
        className={cn(lead && "text-center")}
      />
    </div>
  )
}
