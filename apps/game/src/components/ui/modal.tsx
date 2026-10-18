import { cn } from "@repo/nativ/utils"
import type { ReactNode } from "react"
import { useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"
import { CloseIcon } from "@/components/icons"
import { TapButton } from "@/components/ui/tap-button"

export type ModalProps = {
  open: boolean
  onClose: () => void
  title?: ReactNode
  /** What to call the dialog when there is no visible title to name it. */
  ariaLabel?: string
  /** A line under the title, for a dialog whose heading needs a sentence. */
  description?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  className?: string
}

// Everything a Tab press can land on. Disabled controls and `tabindex="-1"`
// are skipped by the browser, so they are skipped here too.
const TABBABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",")

/**
 * The Tab stops inside a dialog, in order. A radio group is one stop, its
 * checked radio, and an element with no box (inside a collapsed section) is
 * not a stop at all.
 */
function tabStops(dialog: HTMLElement): HTMLElement[] {
  return [...dialog.querySelectorAll<HTMLElement>(TABBABLE)].filter(
    (element) => {
      if (element.getClientRects().length === 0) return false
      if (!(element instanceof HTMLInputElement)) return true
      if (element.type !== "radio" || element.checked) return true
      const group = dialog.querySelector(
        `input[type='radio'][name='${CSS.escape(element.name)}']:checked`,
      )
      return group === null
    },
  )
}

/**
 * Centred overlay dialog. Closes on Escape and on backdrop click.
 *
 * It holds the keyboard while it is open, as a modal dialog must: focus moves
 * in when it opens, Tab and Shift+Tab go round inside it, and when it closes
 * focus goes back to whatever had it before, usually the button that opened it.
 */
export function Modal({
  open,
  onClose,
  title,
  ariaLabel,
  description,
  children,
  footer,
  className,
}: ModalProps) {
  const { t } = useTranslation()
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!open || dialog === null) return
    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    // A field that asked for focus on mount already has it; leave it there.
    if (!dialog.contains(document.activeElement)) {
      ;(tabStops(dialog)[0] ?? dialog).focus()
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return
      const stops = tabStops(dialog)
      const first = stops[0]
      const last = stops.at(-1)
      if (first === undefined || last === undefined) {
        event.preventDefault()
        return
      }
      const active = document.activeElement
      const outside = !dialog.contains(active) || active === dialog
      if (event.shiftKey && (outside || active === first)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (outside || active === last)) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("keydown", onKeyDown)
      // The opener may be gone by now, a menu item that closed with its menu.
      if (opener?.isConnected) opener.focus()
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKeyDown)
    // No scroll lock to take: the document never scrolls, and the page behind
    // this one keeps its scroll inside a box that doesn't chain.
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [onClose, open])

  if (!open) return null

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: the backdrop's press is a courtesy on top of Escape and the close button, not the only way out.
    // biome-ignore lint/a11y/useKeyWithClickEvents: Escape already closes this — see the listener above.
    <div
      className="fixed inset-0 z-1000 flex items-center justify-center bg-overlay p-4 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
        aria-modal="true"
        aria-label={
          ariaLabel ?? (typeof title === "string" ? title : undefined)
        }
        className={cn(
          // Never taller than the screen it sits on. A dialog with more to say
          // than fits scrolls its own body, so the title, the close button and
          // the footer stay where you left them.
          "relative flex max-h-full w-full max-w-md flex-col rounded-[20px] bg-surface p-[26px] outline-none",
          className,
        )}
      >
        <TapButton
          onClick={onClose}
          aria-label={t("common:actions.close")}
          className="absolute top-[18px] right-[18px] flex size-11 hit-[4px] items-center justify-center rounded-[13px] text-faint transition hover:bg-white/10 hover:text-white"
        >
          <CloseIcon size={19} />
        </TapButton>

        {(title || description) && (
          <div className="mb-5 shrink-0 pr-10">
            {title && (
              <h3 className="font-display text-2xl font-bold tracking-[-0.02em] text-white">
                {title}
              </h3>
            )}
            {description && (
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {description}
              </p>
            )}
          </div>
        )}
        {/* Shrinkable rather than `flex-1`: a zero basis would collapse the body
            to nothing in a dialog that is only as tall as what it holds.
            A scroller clips on both axes, so a focus ring drawn outside a
            field's edge, or a switch's hit area hanging past the last row,
            needs room inside this box: the padding gives it that and the
            negative margin hands the space straight back. */}
        <div className="panel-scroll -m-1 min-h-0 overflow-y-auto p-1">
          {children}
        </div>
        {footer && (
          <div className="mt-5 flex shrink-0 gap-3">{footer}</div>
        )}
      </div>
    </div>
  )
}
