import { BOARD_SETUPS } from "@repo/abalone-engine/board-setups"
import { cn } from "@repo/nativ/utils"
import type { KeyboardEvent } from "react"
import { useRef } from "react"
import { useTranslation } from "react-i18next"
import { CheckIcon } from "@/components/icons"
import { BoardThumb } from "@/components/online/board-thumb"
import { TapButton } from "@/components/ui/tap-button"
import type { BoardTheme } from "@/render/board-themes"
import { BOARD_THEME_NAMES } from "@/render/board-themes"

const NAME_KEYS: Record<BoardTheme, string> = {
  slate: "game:controls.board_theme_slate",
  walnut: "game:controls.board_theme_walnut",
  felt: "game:controls.board_theme_felt",
}

/** The opening position every tile shows, so the tiles differ only in paint. */
const STANDARD = {
  black: BOARD_SETUPS.standard.black.map(([r, q]) => `${r},${q}`),
  white: BOARD_SETUPS.standard.white.map(([r, q]) => `${r},${q}`),
}

/** Which way each arrow key steps along the row of tiles. */
const STEPS: Record<string, number> = {
  ArrowRight: 1,
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowUp: -1,
}

export type BoardThemePickerProps = {
  value: BoardTheme
  onChange: (value: BoardTheme) => void
}

/**
 * The board themes as three tiles, each a small board in its own colours.
 *
 * A radio group in full: one tab stop, on the checked tile, and the arrow keys
 * move the choice along the row and the focus with it, as a native group of
 * radios does. The checked tile says so with a border and a check mark, so it is
 * not left to colour alone, which is the one thing these tiles are about.
 */
export function BoardThemePicker({
  value,
  onChange,
}: BoardThemePickerProps) {
  const { t } = useTranslation()
  const tiles = useRef<(HTMLButtonElement | null)[]>([])

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const current = BOARD_THEME_NAMES.indexOf(value)
    const count = BOARD_THEME_NAMES.length
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
    onChange(BOARD_THEME_NAMES[next])
    tiles.current[next]?.focus()
  }

  return (
    <div
      role="radiogroup"
      aria-label={t("game:controls.board_theme")}
      onKeyDown={handleKeyDown}
      className="flex gap-2 lg:gap-3"
    >
      {BOARD_THEME_NAMES.map((theme, index) => {
        const checked = theme === value
        return (
          <TapButton
            key={theme}
            ref={(element) => {
              tiles.current[index] = element
            }}
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            data-board-theme={theme}
            onClick={() => onChange(theme)}
            className={cn(
              "relative flex min-h-11 min-w-11 flex-1 flex-col items-center gap-1 rounded-xl border-2 bg-surface-2 px-2 py-2 transition",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
              checked
                ? "border-brand-lighter"
                : "border-transparent hover:bg-surface-3",
            )}
          >
            <BoardThumb
              blackCells={STANDARD.black}
              whiteCells={STANDARD.white}
              theme={theme}
              className="h-12 lg:h-16"
            />
            <span
              className={cn(
                "max-w-full truncate font-display text-xs font-semibold",
                checked ? "text-white" : "text-muted",
              )}
            >
              {t(NAME_KEYS[theme])}
            </span>
            {checked && (
              <CheckIcon
                size={16}
                strokeWidth={3}
                className="absolute top-1 right-1 rounded-full bg-brand-lighter p-0.5 text-surface"
              />
            )}
          </TapButton>
        )
      })}
    </div>
  )
}
