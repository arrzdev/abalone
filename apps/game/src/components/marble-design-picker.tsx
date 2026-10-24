import { cn } from "@repo/nativ/utils"
import type { KeyboardEvent } from "react"
import { useRef } from "react"
import { useTranslation } from "react-i18next"
import { CheckIcon } from "@/components/icons"
import { MarbleGlyph } from "@/components/marble-glyph"
import { TapButton } from "@/components/ui/tap-button"
import type { MarbleDesign } from "@/render/marble-renderer"
import { MARBLE_DESIGN_NAMES } from "@/render/marble-renderer"

const NAME_KEYS: Record<MarbleDesign, string> = {
  default: "game:controls.marble_design_classic",
  "3d": "game:controls.marble_design_3d",
  sports: "game:controls.marble_design_sports",
}

/** Which way each arrow key steps along the row of tiles. */
const STEPS: Record<string, number> = {
  ArrowRight: 1,
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowUp: -1,
}

export type MarbleDesignPickerProps = {
  value: MarbleDesign
  onChange: (value: MarbleDesign) => void
}

/**
 * The marble designs as tiles, each a white and a black marble in that design.
 *
 * The marbles are drawn by the board's own renderer, so a tile cannot show a
 * design the board does not paint. Otherwise it is the board theme picker over
 * again: a radio group with one tab stop and arrow keys, one 44px row per tile,
 * and the checked tile marked by a border and a check rather than colour alone.
 *
 * The marbles sit above the name rather than beside it: three tiles share a
 * 320px row, and side by side the names had no room left.
 */
export function MarbleDesignPicker({
  value,
  onChange,
}: MarbleDesignPickerProps) {
  const { t } = useTranslation()
  const tiles = useRef<(HTMLButtonElement | null)[]>([])

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const current = MARBLE_DESIGN_NAMES.indexOf(value)
    const count = MARBLE_DESIGN_NAMES.length
    let next: number | null = null
    if (event.key in STEPS) {
      next = (current + STEPS[event.key] + count) % count
    } else if (event.key === "Home") {
      next = 0
    } else if (event.key === "End") {
      next = count - 1
    }
    if (next === null) return
    event.preventDefault()
    onChange(MARBLE_DESIGN_NAMES[next])
    tiles.current[next]?.focus()
  }

  return (
    <div
      role="radiogroup"
      aria-label={t("game:controls.marble_design")}
      onKeyDown={handleKeyDown}
      className="flex gap-2 lg:gap-3"
    >
      {MARBLE_DESIGN_NAMES.map((design, index) => {
        const checked = design === value
        return (
          <TapButton
            key={design}
            ref={(element) => {
              tiles.current[index] = element
            }}
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            data-marble-design={design}
            onClick={() => onChange(design)}
            className={cn(
              "relative flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl border-2 bg-surface-2 px-1.5 py-0.5 transition",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
              checked
                ? "border-brand-lighter"
                : "border-transparent hover:bg-surface-3",
            )}
          >
            <span className="flex shrink-0 -space-x-1">
              <MarbleGlyph color="white" design={design} size={16} />
              <MarbleGlyph color="black" design={design} size={16} />
            </span>
            <span
              className={cn(
                "max-w-full truncate font-display text-xs leading-tight font-semibold",
                checked ? "text-white" : "text-muted",
              )}
            >
              {t(NAME_KEYS[design])}
            </span>
            {checked && (
              <CheckIcon
                size={16}
                strokeWidth={3}
                className="absolute -top-1 -right-1 rounded-full bg-brand-lighter p-0.5 text-surface"
              />
            )}
          </TapButton>
        )
      })}
    </div>
  )
}
