import { Drawer } from "@repo/nativ/components"
import { cn } from "@repo/nativ/utils"
import type { ReactNode } from "react"
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
  /** Extra classes for the panel itself — the dialog box, or the sheet. */
  className?: string
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
  className,
}: SheetProps) {
  const isDesktop = useIsDesktop()

  if (isDesktop) {
    return (
      <Modal
        open={open}
        onClose={onClose}
        title={hideTitle ? undefined : title}
        ariaLabel={typeof title === "string" ? title : undefined}
        footer={footer}
        className={className}
      >
        {description && (
          <p className="mb-5 text-sm leading-relaxed text-white/55">
            {description}
          </p>
        )}
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
    >
      <Drawer.Portal>
        <Drawer.Overlay className="bg-black/60 backdrop-blur-sm" />
        <Drawer.Content
          className={cn(
            "rounded-t-2xl bg-surface-2 text-white ring-1 ring-white/10",
            className,
          )}
          //the footer, last in the scroll flow, carries the inset when there is
          //one — otherwise the scroller owes the home indicator its clearance
          scrollClassName={footer ? "pb-2" : "pb-safe-or-5"}
        >
          <Drawer.Handle className="bg-elevated-3" />

          <Drawer.Shell className="gap-y-4 px-safe-offset-5 pb-1">
            {/* `sr-only` is absolutely positioned, so it leaves the flex flow
                entirely — the shell's gap never opens for a heading that is not
                on the screen. */}
            {title && hideTitle && (
              <Drawer.Title className="sr-only">{title}</Drawer.Title>
            )}

            {!hideTitle && (title || description) && (
              <div className="flex flex-col gap-y-1">
                {title && (
                  <Drawer.Title className="text-xl font-bold text-white">
                    {title}
                  </Drawer.Title>
                )}
                {description && (
                  <Drawer.Description className="text-sm leading-relaxed text-white/55">
                    {description}
                  </Drawer.Description>
                )}
              </div>
            )}
            {children}
          </Drawer.Shell>

          {footer && (
            <Drawer.Footer className="flex-row gap-3 px-safe-offset-5 pt-4 pb-safe-or-5">
              {footer}
            </Drawer.Footer>
          )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer>
  )
}
