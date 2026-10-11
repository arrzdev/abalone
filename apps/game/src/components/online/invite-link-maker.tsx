import { useMutation } from "@tanstack/react-query"
import { useId } from "react"
import { useTranslation } from "react-i18next"
import { ShareLinkButton } from "@/components/online/share-link-button"
import { Button } from "@/components/ui/button"
import { TextField } from "@/components/ui/text-field"
import type { CreateInviteLinkInput } from "@/data/online/mutations"
import { createInviteLinkMutationOptions } from "@/data/online/mutations"
import { useApiError } from "@/hooks/use-api-error"

export type InviteLinkMakerProps = CreateInviteLinkInput & {
  /** Called once the server hands the link back. */
  onCreated?: () => void
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
 */
export function InviteLinkMaker({
  setupType,
  side,
  onCreated,
}: InviteLinkMakerProps) {
  const { t } = useTranslation()
  const errorId = useId()
  const translateError = useApiError()
  const create = useMutation(createInviteLinkMutationOptions)

  const url = create.data?.url

  return (
    <div className="flex flex-col">
      {!url && (
        <>
          <p className="field-label mb-2">{t("online:link.heading")}</p>
          <Button
            variant="outline"
            size="md"
            className="w-full"
            disabled={create.isPending}
            aria-describedby={errorId}
            onClick={() =>
              create.mutate({ setupType, side }, { onSuccess: onCreated })
            }
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
        <div className="flex flex-col gap-y-3">
          <TextField
            label={t("online:link.field")}
            value={url}
            readOnly
            onFocus={(event) => event.currentTarget.select()}
          />
          <ShareLinkButton
            url={url}
            text={t("online:link.share_text")}
            variant="outline"
            size="md"
            className="w-full"
          />
        </div>
      )}
    </div>
  )
}
