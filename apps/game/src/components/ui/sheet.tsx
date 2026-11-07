import { Drawer } from "@repo/nativ/components"
import { cn } from "@repo/nativ/utils"
import type { ReactNode } from "react"
import { useEffect, useId } from "react"
import { Modal } from "@/components/ui/modal"
import { useIsDesktop } from "@/hooks/use-is-desktop"

export type SheetProps = {
  open: boolean
  onClose: () => void
  title?: ReactNode
  /**
   * Keep the title for screen readers and take it off the screen. For an
   * overlay whose own content already names it — a form whose first control is
   * the word the heading would have been.
   */
  hideTitle?: boolean
  /** A line under the title. Optional, and the same on both shapes. */
  description?: ReactNode
  children?: ReactNode
  /** Actions, pinned below the body on desktop and last in the scroll on a phone. */
  footer?: ReactNode
  /**
   * Keep the footer in view on a phone while the body scrolls under it. For an
   * overlay whose action must not be found by scrolling, on a screen too short
   * for all of it. The dialog shape pins its footer already.
   */
  pinFooter?: boolean
  /** Extra classes for the panel itself — the dialog box, or the sheet. */
  className?: string
  /**
   * The id of a heading in `children` that names the overlay, for one whose
   * heading is part of its own layout and cannot be handed over as `title`.
   */
  labelledBy?: string
  /** The id of the line in `children` that says more about the overlay. */
  describedBy?: string
  /**
   * Where focus goes on close when the control that opened the overlay is gone
   * with the thing it opened: a game that ended, say. Otherwise focus goes back
   * to that control.
   */
  restoreFocus?: () => HTMLElement | null | undefined
}

/**
 * One overlay, two shapes: a bottom sheet on a phone, a centred dialog on a
 * desktop.
 *
 * A dialog floating in the middle of a phone screen is a desktop habit — it
 * lands under the thumb badly, it has no gesture to dismiss it, and the keyboard
 * shoves it around. The sheet is draggable, reachable, and moves with the
 * keyboard, and above `lg` none of that applies so the dialog is the better
 * shape. Callers say what is in the overlay and nothing about which one they get.
 *
 * Keep it mounted while closed — the sheet's exit animation needs the element to
 * still be there to play out.
 */
export function Sheet({
  open,
  onClose,
  title,
  hideTitle = false,
  description,
  children,
  footer,
  pinFooter = false,
  className,
  labelledBy,
  describedBy,
  restoreFocus,
}: SheetProps) {
  const isDesktop = useIsDesktop()
  const titleId = useId()

  // Escape closes the dialog shape on its own (`Modal`); the sheet has to be
  // told. A keyboard on a tablet or a phone is still a keyboard.
  useEffect(() => {
    if (!open || isDesktop) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [isDesktop, onClose, open])

  if (isDesktop) {
    return (
      <Modal
        open={open}
        onClose={onClose}
        title={hideTitle ? undefined : title}
        ariaLabel={typeof title === "string" ? title : undefined}
        description={hideTitle ? undefined : description}
        footer={footer}
        className={className}
        labelledBy={labelledBy}
        describedBy={describedBy}
        restoreFocus={restoreFocus}
      >
        {children}
      </Modal>
    )
  }

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      restoreFocus={restoreFocus}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="bg-overlay backdrop-blur-sm" />
        <Drawer.Content
          //the sheet answers to its title, shown or not, as the desktop dialog does
          aria-labelledby={labelledBy ?? (title ? titleId : undefined)}
          aria-describedby={describedBy}
          className={cn(
            "rounded-t-2xl bg-surface text-white ring-1 ring-border",
            className,
          )}
          //the footer, last in the scroll flow, carries the inset when there is
          //one — otherwise the scroller owes the home indicator its clearance
          scrollClassName={footer ? "pb-2" : "pb-safe-or-5"}
        >
          <Drawer.Handle className="bg-surface-4" />

          <Drawer.Shell className="gap-y-5 px-safe-offset-5 pb-1">
            {/* `sr-only` is absolutely positioned, so it leaves the flex flow
                entirely — the shell's gap never opens for a heading that is not
                on the screen. */}
            {title && hideTitle && (
              <Drawer.Title id={titleId} className="sr-only">
                {title}
              </Drawer.Title>
            )}

            {!hideTitle && (title || description) && (
              <div className="flex flex-col gap-y-2">
                {title && (
                  <Drawer.Title
                    id={titleId}
                    className="font-display text-[22px] font-bold tracking-[-0.02em] text-white"
                  >
                    {title}
                  </Drawer.Title>
                )}
                {description && (
                  <Drawer.Description className="text-sm leading-relaxed text-muted">
                    {description}
                  </Drawer.Description>
                )}
              </div>
            )}
            {children}
          </Drawer.Shell>

          {/* pt-4 on top of the shell's pb-1: the section gap, 20px, from the
              last block to the actions, as in the dialog shape */}
          {footer && (
            <Drawer.Footer
              className={cn(
                "flex-row gap-3 px-safe-offset-5 pt-4 pb-safe-or-5",
                pinFooter && "sticky bottom-0 bg-surface",
              )}
            >
              {footer}
            </Drawer.Footer>
          )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer>
  )
}
