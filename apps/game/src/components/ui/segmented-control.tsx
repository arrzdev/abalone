import { cn } from "@repo/nativ/utils"
import type { ReactNode } from "react"
import { TapButton } from "@/components/ui/tap-button"

export type SegmentedOption<T extends string> = {
  value: T
  label: string
  icon?: ReactNode
}

/**
 * One control at three heights, and each is the height of its own segment. The
 * track's 4px padding is the same in all of them, so the control stands 8px
 * taller than whichever of these it is given and the sliding indicator lines up
 * either way.
 *
 * Stated as a height rather than as vertical padding, which is what these used
 * to be. A switch is picked to sit level with something — a column of fields, a
 * row of a panel — and a padding you have to add a line-height to before you
 * know what it comes to is not a number you can match anything against. Same
 * reason `Button` names its sizes this way.
 *
 * `md` is the default. `row` is level with the 48px rows a panel is built from —
 * a 40px control in a padded track, which is what the setup carousel under it
 * is too. `lg` is for the top of a form, read against a column of 54px fields.
 *
 * The two larger ones step down to `md`'s type and padding in a track under
 * 24rem, which is every phone: at 16px "Create account" and most of its
 * translations wrap in a 320px drawer, and at 14px they fit on one line.
 */
const SIZES = {
  md: "h-11 -my-1 px-2 text-sm",
  row: "h-11 -my-0.5 px-3 text-base @max-sm:px-2 @max-sm:text-sm",
  lg: "h-12 px-3 text-base @max-sm:px-2 @max-sm:text-sm",
}

export type SegmentedControlProps<T extends string> = {
  value: T
  onChange: (value: T) => void
  options: SegmentedOption<T>[]
  size?: keyof typeof SIZES
  className?: string
  ariaLabel?: string
}

/**
 * Two-or-more-way switch rendered as one pill.
 *
 * The highlight is a single absolutely-positioned element that slides
 * between segments instead of one background per button, so switching reads as
 * one thing moving. Segments are equal width (`flex-1` zeroes the basis), which
 * is what lets the indicator be sized as a plain fraction of the track.
 */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  size = "md",
  className,
  ariaLabel,
}: SegmentedControlProps<T>) {
  const activeIndex = options.findIndex((option) => option.value === value)

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      //sunken rather than raised: a track the same shade as the controls
      //beside it reads as another one of them, and what makes a switch a switch
      //is that the thing you picked stands out of a groove
      //a container, so the segments can drop their icons when the track itself
      //is narrow, whatever the viewport around it
      className={cn(
        "@container relative flex rounded-xl bg-well p-1",
        className,
      )}
    >
      {activeIndex >= 0 && (
        <span
          aria-hidden="true"
          className="absolute top-1 bottom-1 left-1 rounded-lg bg-brand-fill shadow transition-transform duration-300 ease-out motion-reduce:transition-none"
          style={{
            // The track is the container minus its 0.25rem padding on each side.
            width: `calc((100% - 0.5rem) / ${options.length})`,
            transform: `translateX(${activeIndex * 100}%)`,
          }}
        />
      )}

      {options.map((option) => {
        const active = option.value === value
        return (
          <TapButton
            key={option.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            title={option.label}
            className={cn(
              "relative z-10 flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg font-semibold",
              SIZES[size],
              "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
              // Only the label brightens on hover — a background change here
              // reads as a second selected segment.
              active ? "text-white" : "text-muted hover:text-white",
            )}
          >
            {/* On the narrowest phones the icon is what pushes the label out
                of its segment, and the label is the part that says something. */}
            {option.icon && (
              <span className="shrink-0 @max-xs:hidden">
                {option.icon}
              </span>
            )}
            {/* Labels vary a lot in length between languages. Every one fits a
                line at 320 today; one that stops fitting wraps to a second
                rather than being cut off:
                the segments have a fixed height, so the control stays the same
                size and the two segments stay even. */}
            <span className="line-clamp-2 min-w-0 text-center leading-tight text-balance">
              {option.label}
            </span>
          </TapButton>
        )
      })}
    </div>
  )
}
