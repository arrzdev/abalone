import { cn } from "@repo/nativ/utils"
import type { ComponentType } from "react"
import type { IconProps } from "@/components/icons"
import { TapButton } from "@/components/ui/tap-button"

const TONES = {
  brand: {
    row: "bg-brand hover:bg-brand-hover",
    icon: "text-white",
    hint: "text-subtle",
  },
  neutral: {
    row: "bg-surface hover:bg-surface-2",
    icon: "text-muted",
    hint: "text-faint",
  },
  /** The pair inside a panel, which is already `surface`. */
  sunken: {
    row: "bg-surface-2 hover:bg-surface-3",
    icon: "text-muted",
    hint: "text-faint",
  },
}

const SIZES = {
  /** The full-width row: the front door, and the tab bar's sheet. */
  row: {
    box: "h-[74px] gap-3.5 rounded-2xl px-5 lg:h-[68px] lg:gap-3.5 lg:px-[22px]",
    icon: 22,
    title: "text-lg lg:text-[19px]",
    hint: "text-[13px]",
  },
  /**
   * Half a row, two side by side, where the choice is the smaller one. Smaller
   * in type and in width, not in height: the three of them sit in one block, and
   * a pair ten pixels shorter than the row above reads as a row that came out
   * wrong rather than as a quieter offer.
   */
  tile: {
    box: "h-[68px] gap-3 rounded-2xl px-4",
    icon: 20,
    title: "text-[15px]",
    hint: "text-xs",
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
 * One way into a game, as a row: what it is and what it means.
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
    //no arrow. these are a set to choose from rather than a list of
    //departures, and the one that carries the colour is already the loudest
    //thing on the screen — an arrow on the end of it is a second way of saying
    //press me. what an arrow does still belong to is the rules link under
    //them, which really is somewhere else to go.
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
    </TapButton>
  )
}
