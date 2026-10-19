import { cn } from "@repo/nativ/utils"
import type { ComponentProps, ReactNode } from "react"
import { SpinnerIcon } from "@/components/icons"
import type { TapHandler } from "@/hooks/use-click-fix"
import { useClickFix } from "@/hooks/use-click-fix"

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 " +
  "focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-45"

//a fill and a hover, and nothing under either: a brand-tinted shadow behind a
//brand-coloured button is the button's own colour blurred onto the page
const VARIANTS = {
  primary: "bg-brand-fill text-white hover:bg-brand-fill-hover",
  secondary: "bg-surface-3 text-white hover:bg-surface-4",
  outline: "bg-surface-2 text-white hover:bg-surface-3",
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
  sm: "h-11 hit-[4px] rounded-xl px-3 text-sm",
  md: "h-11 px-5 text-base",
  //the page's one commitment, so it is the one size set in the display face:
  //rounder, taller, and named in the type the headings are set in
  lg: "h-[54px] rounded-xl px-6 font-display text-[17px]",
  fill: "self-stretch px-4 text-base",
  "icon-sm": "h-9 w-9 shrink-0",
  icon: "h-11 w-11 shrink-0",
  "icon-lg": "h-14 w-14 shrink-0",
}

export type ButtonVariant = keyof typeof VARIANTS
export type ButtonSize = keyof typeof SIZES

/**
 * A button's look without the button, for a link that goes somewhere: a link
 * styled by hand drifts from the buttons beside it the first time either changes.
 */
export function buttonClassName(
  variant: ButtonVariant = "secondary",
  size: ButtonSize = "md",
) {
  return cn(BASE, VARIANTS[variant], SIZES[size])
}

export type ButtonProps = Omit<ComponentProps<"button">, "onClick"> & {
  variant?: ButtonVariant
  size?: ButtonSize
  onClick?: TapHandler
  /** Waiting on the network: a spinner in place of the label, busy, and disabled. */
  pending?: boolean
}

/**
 * `onClick` goes through `useClickFix`, so every button in the app presses on
 * the release of the tap that pressed it rather than on the click that follows.
 * The step buttons under the move list are the reason: they are the pair most
 * likely to be tapped several times in a row, which is the pattern iOS mistimes.
 *
 * `pending` is for a press that waits on the network. A button that looks the
 * same while its request is out reads as frozen and gets pressed again, so it
 * spins, says it is busy, and takes no second press. The label stays where it
 * was, only see-through, so the button keeps its width and its accessible name.
 */
export function Button({
  variant = "secondary",
  size = "md",
  className,
  type = "button",
  onClick,
  pending = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const tap = useClickFix(onClick)
  return (
    <button
      type={type}
      className={cn(
        buttonClassName(variant, size),
        pending && "relative disabled:opacity-100",
        className,
      )}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      {...tap}
      {...props}
    >
      <PendingContent
        pending={pending}
        spinnerSize={size === "sm" ? 16 : 18}
      >
        {children}
      </PendingContent>
    </button>
  )
}

export type PendingContentProps = {
  pending: boolean
  spinnerSize?: number
  children: ReactNode
}

/**
 * The inside of a button while it waits: the label see-through and in place, so
 * nothing moves, and a spinner over it. For the few buttons drawn by hand
 * rather than with `Button`; the button itself still needs `relative`,
 * `aria-busy` and `disabled`.
 */
export function PendingContent({
  pending,
  spinnerSize = 18,
  children,
}: PendingContentProps) {
  if (!pending) return children
  return (
    <>
      <span className="inline-flex items-center justify-center gap-[inherit] opacity-0">
        {children}
      </span>
      <span
        data-spinner
        aria-hidden="true"
        className="absolute inset-0 flex items-center justify-center"
      >
        <SpinnerIcon size={spinnerSize} className="animate-spin" />
      </span>
    </>
  )
}
