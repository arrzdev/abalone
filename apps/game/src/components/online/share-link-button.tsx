import tryCatch from "@repo/shared/try-catch"
import { useId, useState } from "react"
import { useTranslation } from "react-i18next"
import type { ButtonProps } from "@/components/ui/button"
import { Button } from "@/components/ui/button"

/** What the line under the button says after a hand-off. */
export type HandOffStatus = "idle" | "copied" | "failed"

export type ShareLinkButtonProps = Omit<
  ButtonProps,
  "onClick" | "children"
> & {
  url: string
  /** The line a share sheet puts with the link. */
  text: string
  /**
   * The line under the button, for a caller that hands the link on itself as
   * well (the empty online page, which shares it the moment it exists). Left
   * out, the button keeps its own.
   */
  status?: HandOffStatus
  onStatusChange?: (status: HandOffStatus) => void
}

/** Whether this browser has a share sheet to hand a link to. */
export function canShareLinks() {
  return typeof navigator !== "undefined" && "share" in navigator
}

/**
 * Hands a link on: the share sheet where there is one, the clipboard where
 * there is not.
 *
 * A share always comes back `idle`: a dismissed share sheet rejects too, and
 * dismissing it is not a failure worth a sentence.
 */
export async function handOffLink(
  url: string,
  text: string,
): Promise<HandOffStatus> {
  if (canShareLinks()) {
    await tryCatch(() => navigator.share({ url, text }))
    return "idle"
  }

  const [, error] = await tryCatch(() =>
    navigator.clipboard.writeText(url),
  )
  return error ? "failed" : "copied"
}

/**
 * Hands a link on: the system share sheet where there is one, the clipboard
 * where there is not.
 *
 * One button rather than both, because a phone's share sheet already has "Copy"
 * in it, and a desktop without one has nothing else to offer. Which one this is
 * gets decided once, on mount of the button, from whether `navigator.share`
 * exists at all.
 *
 * The confirmation for a copy is a line under the button rather than a new
 * label on it: the button keeps its name for a screen reader and for a second
 * press, and the line is a live region that says it happened.
 */
export function ShareLinkButton({
  url,
  text,
  status: statusProp,
  onStatusChange,
  className,
  ...props
}: ShareLinkButtonProps) {
  const { t } = useTranslation()
  const statusId = useId()
  const [canShare] = useState(canShareLinks)
  const [ownStatus, setOwnStatus] = useState<HandOffStatus>("idle")

  const status = statusProp ?? ownStatus

  async function handlePress() {
    const next = await handOffLink(url, text)
    setOwnStatus(next)
    onStatusChange?.(next)
  }

  return (
    <div className="flex flex-col">
      <Button
        {...props}
        className={className}
        aria-describedby={statusId}
        onClick={handlePress}
      >
        {canShare && t("online:link.share")}
        {!canShare && t("online:link.copy")}
      </Button>

      {/* Always in the layout, so the line arriving does not push anything
          under the thumb. */}
      <p
        id={statusId}
        role="status"
        className="mt-2 min-h-5 text-[13px] leading-5 text-muted"
      >
        {status === "copied" && t("online:link.copied")}
        {status === "failed" && t("online:link.copy_failed")}
      </p>
    </div>
  )
}
