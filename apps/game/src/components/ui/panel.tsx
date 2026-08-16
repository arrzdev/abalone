import { cn } from "@repo/nativ/utils"
import type { ReactNode } from "react"

export type PanelProps = {
  children: ReactNode
  className?: string
}

/**
 * The one surface every list, form and group of rows in the app sits on.
 *
 * It clips, because what goes in it are rows that run edge to edge and would
 * otherwise square off the corners the panel just rounded. It has no padding of
 * its own for the same reason — a row's padding is the row's, and a header's is
 * the header's, so a full-bleed divider can still cross the whole panel.
 *
 * No shadow. A shadow is how a light surface says it is above a lighter one; on
 * this ground the step in grey already says it, and a drop shadow under every
 * panel on the page reads as smudging rather than as depth.
 */
export function Panel({ children, className }: PanelProps) {
  return (
    <div
      className={cn("overflow-hidden rounded-2xl bg-surface", className)}
    >
      {children}
    </div>
  )
}

export type PanelHeaderProps = {
  /** The small wide label. Rendered as-is — the class does the shouting. */
  children: ReactNode
  /** How many rows are under it. Hidden at zero: a count of none is noise. */
  count?: number
  /** The panel's own action, at the far end. */
  action?: ReactNode
  className?: string
}

/**
 * The label over a panel's rows, the count beside it, and the panel's action at
 * the far end.
 *
 * The count is the accent's only job here. Four identical headings with nothing
 * to separate them was the old lobby's problem: nothing said which list was the
 * one to look at. A number in the accent colour says it in one glyph, and the
 * lists that never have anything urgent in them simply never pass one.
 */
export function PanelHeader({
  children,
  count,
  action,
  className,
}: PanelHeaderProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 px-4 pt-3.5 pb-2.5 lg:px-[18px] lg:pt-[15px] lg:pb-[11px]",
        className,
      )}
    >
      <h2 className="section-label">{children}</h2>

      {count !== undefined && count > 0 && (
        <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[5px] bg-brand px-1.5 font-display text-[11px] font-bold text-white tabular-nums">
          {count}
        </span>
      )}

      {action && <div className="ms-auto flex items-center">{action}</div>}
    </div>
  )
}

export type PanelRowsProps = {
  children: ReactNode
  className?: string
}

/**
 * The rows under a header, hairlined off each other and off the header.
 *
 * The divider is on the top of every row rather than between them, so the first
 * row is cut off from the header too — which is the line that matters, since the
 * header is the only thing in the panel that is not a row.
 */
export function PanelRows({ children, className }: PanelRowsProps) {
  return (
    <div
      className={cn(
        "[&>*]:border-t [&>*]:border-border-subtle",
        className,
      )}
    >
      {children}
    </div>
  )
}
