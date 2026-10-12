import { useMutation } from "@tanstack/react-query"
import { useId, useState } from "react"
import { useTranslation } from "react-i18next"
import type { HandOffStatus } from "@/components/online/share-link-button"
import {
  handOffLink,
  ShareLinkButton,
} from "@/components/online/share-link-button"
import { Button } from "@/components/ui/button"
import { TextField } from "@/components/ui/text-field"
import type { CreateInviteLinkInput } from "@/data/online/mutations"
import { createInviteLinkMutationOptions } from "@/data/online/mutations"
import { useApiError } from "@/hooks/use-api-error"

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
  const errorId = useId()
  const translateError = useApiError()
  const create = useMutation(createInviteLinkMutationOptions)
  const [status, setStatus] = useState<HandOffStatus>("idle")

  const url = create.data?.url
  //as the lead, `min-h` rather than the size's fixed height: the label is three
  //words in English and five in German, and a button that cannot grow spills
  //its second line over its own edges
  const buttonClassName = lead
    ? "h-auto min-h-[54px] w-full py-3 text-balance"
    : "w-full"
  const shareText = t("online:link.share_text")

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
    <div className="flex flex-col">
      {!url && (
        <>
          {!lead && (
            <p className="field-label mb-2">{t("online:link.heading")}</p>
          )}
          <Button
            variant={lead ? "primary" : "outline"}
            size={lead ? "lg" : "md"}
            className={buttonClassName}
            disabled={create.isPending}
            aria-describedby={errorId}
            onClick={handleCreate}
          >
            {create.isPending && t("online:link.creating")}
            {!create.isPending && t("online:link.create")}
          </Button>

          <p
            id={errorId}
            role="alert"
            className="mt-2 min-h-5 text-[13px] leading-5 text-loss"
          >
            {create.error && translateError(create.error)}
          </p>
        </>
      )}

      {url && (
        <div className="flex flex-col gap-y-3 text-start">
          <TextField
            label={t("online:link.field")}
            value={url}
            readOnly
            onFocus={(event) => event.currentTarget.select()}
          />
          <ShareLinkButton
            url={url}
            text={shareText}
            status={status}
            onStatusChange={setStatus}
            variant={lead ? "primary" : "outline"}
            size={lead ? "lg" : "md"}
            className={buttonClassName}
          />
        </div>
      )}
    </div>
  )
}
