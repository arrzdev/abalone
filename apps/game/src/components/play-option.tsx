import { cn } from "@repo/nativ/utils"
import type { ComponentType } from "react"
import type { IconProps } from "@/components/icons"
import { ChevronRightIcon } from "@/components/icons"
import { TapButton } from "@/components/ui/tap-button"

const TONES = {
  brand: {
    row: "bg-brand hover:bg-brand-light",
    tile: "bg-white/15 text-white",
    hint: "text-subtle",
    chevron: "text-muted",
  },
  neutral: {
    row: "bg-surface-4 hover:bg-surface-5",
    tile: "bg-elevated-2 text-white",
    hint: "text-muted",
    chevron: "text-faint",
  },
}

/** `lg` is the front door, where these two are the page. `md` is a sheet's row. */
const SIZES = {
  md: {
    row: "gap-4 p-4",
    tile: "h-11 w-11",
    icon: 22,
    title: "text-base",
  },
  lg: { row: "gap-5 p-5", tile: "h-14 w-14", icon: 26, title: "text-lg" },
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
 * the same row on the front door and in the tab bar's sheet.
 */
export function PlayOption({
  icon: Icon,
  title,
  hint,
  tone = "neutral",
  size = "md",
  onClick,
  className,
}: PlayOptionProps) {
  const style = TONES[tone]
  const scale = SIZES[size]

  return (
    <TapButton
      onClick={onClick}
      className={cn(
        "flex w-full items-center rounded-2xl text-left transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface-2",
        scale.row,
        style.row,
        className,
      )}
    >
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-xl",
          scale.tile,
          style.tile,
        )}
      >
        <Icon size={scale.icon} />
      </span>

      <span className="min-w-0 flex-1">
        <span className={cn("block font-bold text-white", scale.title)}>
          {title}
        </span>
        <span className={cn("mt-0.5 block text-sm", style.hint)}>
          {hint}
        </span>
      </span>

      <ChevronRightIcon
        size={20}
        className={cn("shrink-0", style.chevron)}
      />
    </TapButton>
  )
}
