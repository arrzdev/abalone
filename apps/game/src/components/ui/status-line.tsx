import { cn } from "@repo/nativ/utils"
import { Reserved } from "@/components/ui/reserved"

export type StatusLineProps = {
  id?: string
  /** `alert` for something that went wrong, `status` for a confirmation. */
  role: "alert" | "status"
  /** What the line says now. Left out, the hint shows. */
  message?: string
  /** The colour of the message: red for a failure, muted for news. */
  messageClassName?: string
  /**
   * What the line says while there is nothing to report. Only a line with
   * nothing under it (the last thing on a page) may go without: anywhere else
   * an empty line is a hole between two blocks.
   */
  hint?: string
  /** The colour of the hint, where the line rests in another tone. */
  hintClassName?: string
  /** Every message that can land here, so the line is as tall as the longest. */
  reserve: string[]
  className?: string
}

/**
 * A line of status text under a control, in the layout from the first render.
 *
 * A message that arrives into no space of its own pushes everything under it
 * down, which is a press that moves the thing under the thumb. A line held
 * open and empty is a hole in the middle of the dialog. So the line always has
 * something to say: a hint while nothing has happened, replaced by the message
 * when something has. Every message it can say is stacked in the same cell, so
 * the line is as tall as the longest of them in this language at this width.
 *
 * The live region is its own element and holds only the message, so a screen
 * reader hears what happened and not the hint.
 */
export function StatusLine({
  id,
  role,
  message,
  messageClassName,
  hint,
  hintClassName = "text-muted",
  reserve,
  className,
}: StatusLineProps) {
  return (
    <Reserved className={cn("text-[13px] leading-5", className)}>
      <p id={id} role={role} className={messageClassName}>
        {message}
      </p>

      {hint && (
        <span
          aria-hidden={message ? "true" : undefined}
          className={cn(hintClassName, message && "invisible")}
        >
          {hint}
        </span>
      )}

      {/* Drawn by the pseudo-element rather than as text, so the copies held
          for their height are not text on the page: a search for the message
          finds the one that is showing. */}
      {reserve.map((text) => (
        <span
          key={text}
          aria-hidden="true"
          data-reserve={text}
          className="invisible before:content-[attr(data-reserve)]"
        />
      ))}
    </Reserved>
  )
}
