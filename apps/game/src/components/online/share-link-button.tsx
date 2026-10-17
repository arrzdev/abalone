import tryCatch from "@repo/shared/try-catch"
import { useState } from "react"
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
  /** How the hand-off went, for the status line the caller puts under it. */
  onStatusChange: (status: HandOffStatus) => void
  /** Id of that status line, for `aria-describedby`. */
  statusId?: string
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
 * The confirmation for a copy is a line the caller keeps under the button
 * rather than a new label on it: the button keeps its name for a screen reader
 * and for a second press. The line is the caller's because it is in the layout
 * before this button is, and says other things while there is no link yet.
 */
export function ShareLinkButton({
  url,
  text,
  onStatusChange,
  statusId,
  ...props
}: ShareLinkButtonProps) {
  const { t } = useTranslation()
  const [canShare] = useState(canShareLinks)

  async function handlePress() {
    onStatusChange(await handOffLink(url, text))
  }

  return (
    <Button {...props} aria-describedby={statusId} onClick={handlePress}>
      {canShare && t("online:link.share")}
      {!canShare && t("online:link.copy")}
    </Button>
  )
}
