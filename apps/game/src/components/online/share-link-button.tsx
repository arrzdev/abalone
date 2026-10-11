import tryCatch from "@repo/shared/try-catch"
import { useId, useState } from "react"
import { useTranslation } from "react-i18next"
import type { ButtonProps } from "@/components/ui/button"
import { Button } from "@/components/ui/button"

export type ShareLinkButtonProps = Omit<
  ButtonProps,
  "onClick" | "children"
> & {
  url: string
  /** The line a share sheet puts with the link. */
  text: string
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
  className,
  ...props
}: ShareLinkButtonProps) {
  const { t } = useTranslation()
  const statusId = useId()
  const [canShare] = useState(
    () => typeof navigator !== "undefined" && "share" in navigator,
  )
  const [status, setStatus] = useState<"idle" | "copied" | "failed">(
    "idle",
  )

  async function handlePress() {
    if (canShare) {
      //a dismissed share sheet rejects too, and dismissing it is not a
      //failure worth a sentence
      await tryCatch(() => navigator.share({ url, text }))
      return
    }

    const [, error] = await tryCatch(() =>
      navigator.clipboard.writeText(url),
    )
    setStatus(error ? "failed" : "copied")
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
