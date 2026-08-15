import { cn } from "@repo/nativ/utils"
import type { ComponentType } from "react"
import type { IconProps } from "@/components/icons"
import { ChevronRightIcon } from "@/components/icons"
import { TapButton } from "@/components/ui/tap-button"

const TONES = {
  brand: {
    row: "bg-brand hover:bg-brand-hover",
    icon: "text-white",
    hint: "text-subtle",
    chevron: "text-subtle",
  },
  neutral: {
    row: "bg-surface hover:bg-surface-2",
    icon: "text-muted",
    hint: "text-faint",
    chevron: "text-faint",
  },
  /** The pair inside a panel, which is already `surface`. */
  sunken: {
    row: "bg-surface-2 hover:bg-surface-3",
    icon: "text-muted",
    hint: "text-faint",
    chevron: "text-faint",
  },
}

const SIZES = {
  /** The full-width row: the front door, and the tab bar's sheet. */
  row: {
    box: "h-[74px] gap-3.5 rounded-2xl px-5 lg:h-[68px] lg:gap-3.5 lg:px-[22px]",
    icon: 22,
    title: "text-lg lg:text-[19px]",
    hint: "text-[13px]",
    chevron: 19,
  },
  /** Half a row, two side by side, where the choice is the smaller one. */
  tile: {
    box: "h-[58px] gap-3 rounded-xl px-4",
    icon: 20,
    title: "text-[15px]",
    hint: "text-xs",
    chevron: 0,
  },
}

export type PlayOptionProps = {
  icon: ComponentType<IconProps>
  title: string
  /** The line under it: what choosing this actually means. */
  hint: string
  tone?: keyof typeof TONES
  size?: keyof typeof SIZES
  onClick: () => void
  className?: string
}

/**
 * One way into a game, as a row: what it is, what it means, and an arrow.
 *
 * Online and offline are not the same button twice — one needs an account and a
 * connection, the other never asks for either — so each carries the line that
 * says so instead of leaving a pair of unlabelled verbs to be guessed at. It is
 * the same row on the front door, in the lobby's offline panel, and in the tab
 * bar's sheet.
 *
 * The glyph is a bare stroke rather than a filled tile behind it. A tile is a
 * second box inside a box, and with three of these stacked it is three of them —
 * enough repeated structure that the eye starts reading the tiles instead of the
 * words beside them.
 */
export function PlayOption({
  icon: Icon,
  title,
  hint,
  tone = "neutral",
  size = "row",
  onClick,
  className,
}: PlayOptionProps) {
  const style = TONES[tone]
  const scale = SIZES[size]

  return (
    <TapButton
      onClick={onClick}
      className={cn(
        "flex w-full items-center text-left transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-ground",
        scale.box,
        style.row,
        className,
      )}
    >
      <Icon size={scale.icon} className={cn("shrink-0", style.icon)} />

      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block truncate font-display font-bold text-white",
            scale.title,
          )}
        >
          {title}
        </span>
        <span
          className={cn("mt-0.5 block truncate", scale.hint, style.hint)}
        >
          {hint}
        </span>
      </span>

      {/* The pair has no arrow: side by side they read as a choice between two
          things, and an arrow on each would make them two departures. */}
      {scale.chevron > 0 && (
        <ChevronRightIcon
          size={scale.chevron}
          className={cn("shrink-0", style.chevron)}
        />
      )}
    </TapButton>
  )
}
