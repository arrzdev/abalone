import { cn } from "@repo/nativ/utils"
import type { ComponentProps } from "react"
import type { TapHandler } from "@/hooks/use-click-fix"
import { useClickFix } from "@/hooks/use-click-fix"

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 " +
  "focus-visible:ring-offset-surface-2 disabled:cursor-not-allowed disabled:opacity-45"

//a fill and a hover, and nothing under either: a brand-tinted shadow behind a
//brand-coloured button is the button's own colour blurred onto the page
const VARIANTS = {
  primary: "bg-brand text-white hover:bg-brand-light",
  secondary: "bg-elevated-2 text-white hover:bg-elevated-3",
  outline: "bg-surface-4 text-white hover:bg-surface-5",
  ghost: "text-subtle hover:bg-white/10 hover:text-white",
  danger: "bg-loss text-white hover:brightness-110",
}

/*
 * Icon sizes are squares of the matching text size, so an icon button sitting
 * in a row with a labelled one lines up exactly.
 *
 * `fill` is the one with no height of its own: it takes the height of the row it
 * is in, for the places where the height is the layout's to decide and the space
 * would otherwise sit empty. It stays a size rather than a class passed in
 * because a height belongs with the other heights — even now that `cn` merges,
 * and `h-full` from a caller would win over `h-11` on its own.
 */
const SIZES = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-5 text-base",
  lg: "h-14 px-6 text-lg",
  fill: "self-stretch px-4 text-base",
  "icon-sm": "h-9 w-9 shrink-0",
  icon: "h-11 w-11 shrink-0",
  "icon-lg": "h-14 w-14 shrink-0",
}

export type ButtonVariant = keyof typeof VARIANTS
export type ButtonSize = keyof typeof SIZES

export type ButtonProps = Omit<ComponentProps<"button">, "onClick"> & {
  variant?: ButtonVariant
  size?: ButtonSize
  onClick?: TapHandler
}

/**
 * `onClick` goes through `useClickFix`, so every button in the app presses on
 * the release of the tap that pressed it rather than on the click that follows.
 * The step buttons under the move list are the reason: they are the pair most
 * likely to be tapped several times in a row, which is the pattern iOS mistimes.
 */
export function Button({
  variant = "secondary",
  size = "md",
  className,
  type = "button",
  onClick,
  ...props
}: ButtonProps) {
  const tap = useClickFix(onClick)
  return (
    <button
      type={type}
      className={cn(BASE, VARIANTS[variant], SIZES[size], className)}
      {...tap}
      {...props}
    />
  )
}
