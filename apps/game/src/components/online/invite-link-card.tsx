import { cn } from "@repo/nativ/utils"
import { useMutation } from "@tanstack/react-query"
import { useEffect, useId, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  CheckIcon,
  CopyIcon,
  LinkIcon,
  RotateIcon,
  ShareIcon,
  SpinnerIcon,
} from "@/components/icons"
import type { HandOffStatus } from "@/components/online/share-link-button"
import {
  canShareLinks,
  copyLink,
  handOffLink,
} from "@/components/online/share-link-button"
import { Button } from "@/components/ui/button"
import { Reserved } from "@/components/ui/reserved"
import type { CreateInviteLinkInput } from "@/data/online/mutations"
import { createInviteLinkMutationOptions } from "@/data/online/mutations"

/** How long the copy button shows a check before it is a copy button again. */
const COPIED_MS = 2_000

const CARD_CLASS = "p-2 ps-3"

export type InviteLinkCardProps = CreateInviteLinkInput & {
  /** Called once the server hands the link back. */
  onCreated?: () => void
}

/**
 * The other way to ask, as a card: a link instead of a name.
 *
 * It takes the opening and the side the composer already has, so it asks
 * nothing of its own, and the composer remounts it when either changes, which
 * is what throws away a link made on the old terms.
 *
 * Before the link there is one tap target, the whole card. After it, the card
 * is the link and the two ways to hand it on. The two layouts share one cell,
 * so the card is as tall as the taller from the first render and making the
 * link moves nothing under it, and each holds room for every line it can say.
 */
export function InviteLinkCard({
  setupType,
  side,
  onCreated,
}: InviteLinkCardProps) {
  const { t } = useTranslation()
  const statusId = useId()
  const fieldId = useId()
  const create = useMutation(createInviteLinkMutationOptions)
  const [status, setStatus] = useState<HandOffStatus>("idle")
  const [justCopied, setJustCopied] = useState(false)
  const [canShare] = useState(canShareLinks)
  const copiedTimer = useRef<number>(undefined)

  //the check outlives the tap by two seconds, and the sheet may not
  useEffect(() => () => window.clearTimeout(copiedTimer.current), [])

  const url = create.data?.url
  const isMade = Boolean(url)
  const shareText = t("online:link.share_text")

  const failedText = t("online:link.failed_short")
  const readyText = t("online:link.ready")
  const copiedText = t("online:link.copied_short")
  const copyFailedText = t("online:link.copy_failed_short")

  let madeMessage = readyText
  if (status === "copied") madeMessage = copiedText
  if (status === "failed") madeMessage = copyFailedText

  async function handleCopy() {
    if (!url) return
    const next = await copyLink(url)
    setStatus(next)
    if (next !== "copied") return
    setJustCopied(true)
    window.clearTimeout(copiedTimer.current)
    copiedTimer.current = window.setTimeout(
      () => setJustCopied(false),
      COPIED_MS,
    )
  }

  async function handleShare() {
    if (url) setStatus(await handOffLink(url, shareText))
  }

  function handleCreate() {
    create.mutate(
      { setupType, side },
      {
        onSuccess: async (link) => {
          onCreated?.()
          //WebKit may let the tap's permission to share lapse by now. that
          //refusal says nothing: the link is on screen with its own buttons
          const handedOff = await handOffLink(link.url, shareText)
          if (handedOff !== "failed") setStatus(handedOff)
        },
      },
    )
  }

  //both layouts hold the lines they can say, in the language and at the width
  //they are read at, so neither one grows the card
  const idleLines = [t("online:link.card_hint"), failedText]
  const madeLines = [readyText, copiedText, copyFailedText]

  return (
    <Reserved
      //two lines of status on the narrowest phones must not move the card
      className="rounded-xl bg-surface-2 max-[359px]:min-h-[76px]"
    >
      <button
        type="button"
        className={cn(
          CARD_CLASS,
          "flex items-center gap-3 rounded-xl text-start transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
          isMade && "invisible",
        )}
        aria-busy={create.isPending || undefined}
        aria-describedby={statusId}
        disabled={create.isPending || isMade}
        tabIndex={isMade ? -1 : undefined}
        onClick={handleCreate}
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-surface-3 text-brand-lighter">
          <LinkIcon size={18} />
        </span>

        <span className="block min-w-0 flex-1">
          <span className="block font-display text-[15px] font-bold text-white">
            {t("online:link.create")}
          </span>
          <Reserved className="text-[13px] leading-5">
            <span
              id={isMade ? undefined : statusId}
              role={create.isError ? "alert" : undefined}
              className={create.isError ? "text-loss" : "text-muted"}
            >
              {create.isError && failedText}
              {!create.isError && t("online:link.card_hint")}
            </span>
            {idleLines.map((text) => (
              <span
                key={text}
                aria-hidden="true"
                data-reserve={text}
                className="invisible before:content-[attr(data-reserve)]"
              />
            ))}
          </Reserved>
        </span>

        <span className="flex size-11 shrink-0 items-center justify-center text-muted">
          {create.isPending && (
            <SpinnerIcon size={20} className="animate-spin" />
          )}
          {!create.isPending && create.isError && <RotateIcon size={20} />}
          {!create.isPending && !create.isError && canShare && (
            <ShareIcon size={20} />
          )}
          {!create.isPending && !create.isError && !canShare && (
            <CopyIcon size={20} />
          )}
        </span>
      </button>

      <div
        className={cn(
          CARD_CLASS,
          "flex items-center gap-3",
          !isMade && "invisible",
        )}
        aria-hidden={isMade ? undefined : "true"}
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-brand/18 text-brand-lighter">
          <CheckIcon size={18} />
        </span>

        <span className="block min-w-0 flex-1">
          {/* The whole link is still the value, to select or copy; the field
              ends in an ellipsis where it is longer than the room. */}
          <label className="sr-only" htmlFor={fieldId}>
            {t("online:link.field")}
          </label>
          <input
            id={fieldId}
            readOnly
            value={url ?? ""}
            tabIndex={isMade ? undefined : -1}
            onFocus={(event) => event.currentTarget.select()}
            className="block h-[22px] w-full truncate rounded bg-transparent font-display text-[15px] font-bold text-white text-ellipsis focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          />
          <Reserved className="text-[13px] leading-5">
            <p
              id={isMade ? statusId : undefined}
              role="status"
              className="text-muted"
            >
              {isMade && madeMessage}
            </p>
            {madeLines.map((text) => (
              <span
                key={text}
                aria-hidden="true"
                data-reserve={text}
                className="invisible before:content-[attr(data-reserve)]"
              />
            ))}
          </Reserved>
        </span>

        <Button
          variant="secondary"
          size="icon"
          aria-label={t("online:link.copy")}
          title={t("online:link.copy")}
          aria-describedby={statusId}
          tabIndex={isMade ? undefined : -1}
          onClick={handleCopy}
        >
          {justCopied && <CheckIcon size={20} />}
          {!justCopied && <CopyIcon size={20} />}
        </Button>
        {canShare && (
          <Button
            variant="secondary"
            size="icon"
            aria-label={t("online:link.share")}
            title={t("online:link.share")}
            aria-describedby={statusId}
            tabIndex={isMade ? undefined : -1}
            onClick={handleShare}
          >
            <ShareIcon size={20} />
          </Button>
        )}
      </div>
    </Reserved>
  )
}
