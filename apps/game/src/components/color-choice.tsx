import type { Player } from "@repo/abalone-engine/types"
import { cn } from "@repo/nativ/utils"
import { useTranslation } from "react-i18next"
import { MarbleGlyph } from "@/components/marble-glyph"
import { TapButton } from "@/components/ui/tap-button"

/** What a player may ask to play as; `random` is settled at kick-off. */
export type ColorChoiceValue = Player | "random"

/** How big a marble sits on a tile. Matches the "?" the random tile shows. */
const MARBLE_SIZE = 40

const OPTIONS: {
  value: ColorChoiceValue
  labelKey: string
  nameKey: string
}[] = [
  {
    value: "white",
    labelKey: "game:controls.side_white",
    nameKey: "game:colors.white",
  },
  {
    value: "random",
    labelKey: "game:controls.side_random",
    nameKey: "game:colors.random",
  },
  {
    value: "black",
    labelKey: "game:controls.side_black",
    nameKey: "game:colors.black",
  },
]

export type ColorChoiceProps = {
  value: ColorChoiceValue
  onChange: (value: ColorChoiceValue) => void
  marbleDesign?: string
}

/**
 * Side picker in the chess.com shape: white, random, black as three tiles.
 * `random` stays unresolved until the game actually starts.
 *
 * The tiles share the row rather than being three fixed squares stranded on the
 * left: the panel is the whole screen on a phone, and a marble on its own does
 * not say which side it is until you have picked it once, so each tile is
 * named.
 */
export function ColorChoice({
  value,
  onChange,
  marbleDesign = "default",
}: ColorChoiceProps) {
  const { t } = useTranslation()

  return (
    <div
      role="radiogroup"
      aria-label={t("game:controls.side_group")}
      className="flex gap-2 lg:gap-3"
    >
      {OPTIONS.map((option) => (
        <TapButton
          key={option.value}
          role="radio"
          aria-checked={value === option.value}
          aria-label={t(option.labelKey)}
          title={t(option.labelKey)}
          onClick={() => onChange(option.value)}
          className={cn(
            "group flex min-w-0 flex-1 flex-col items-center justify-center gap-1.5 rounded-xl py-3 transition",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
            // Solid either way — the tile you picked is the accent, the others
            // are the panel's grey. Only the marble on top dims.
            value === option.value
              ? "bg-brand"
              : "bg-surface-2 hover:bg-surface-3",
          )}
        >
          {option.value === "random" ? (
            <span
              className={cn(
                "flex h-10 w-10 items-center justify-center text-3xl leading-none font-black text-subtle transition",
                value !== option.value &&
                  "opacity-70 group-hover:opacity-100",
              )}
            >
              ?
            </span>
          ) : (
            // The marble the player is about to play with, drawn by the board's
            // own renderer: picking a side should show the ball that will be on
            // the board, in whichever design is set, not a lookalike.
            <MarbleGlyph
              color={option.value}
              design={marbleDesign}
              size={MARBLE_SIZE}
              className={cn(
                "transition",
                value !== option.value &&
                  "opacity-70 group-hover:opacity-100",
              )}
            />
          )}
          <span
            className={cn(
              "max-w-full truncate font-display text-xs font-semibold",
              value === option.value ? "text-white" : "text-muted",
            )}
          >
            {t(option.nameKey)}
          </span>
        </TapButton>
      ))}
    </div>
  )
}
