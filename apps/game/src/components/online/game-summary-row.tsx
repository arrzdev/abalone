import type { PlayableSetup } from "@repo/abalone-engine/board-setups"
import { BOARD_SETUPS } from "@repo/abalone-engine/board-setups"
import { useTranslation } from "react-i18next"
import type { ColorChoiceValue } from "@/components/color-choice"
import { BoardThumb } from "@/components/online/board-thumb"
import { Button } from "@/components/ui/button"
import { getSetupName } from "@/i18n/game-text"

export type GameSummaryRowProps = {
  setupType: PlayableSetup
  side: ColorChoiceValue
  /** Opens the panel with the carousel and the side picker. */
  onChange: () => void
}

/**
 * The terms of the game in one line: the opening, your side, and a way to
 * change them.
 *
 * Most invites are the standard opening with a random side, and asking about
 * both every time put a board preview and three tiles between the name and the
 * send button. The terms are still the sender's to set; they are one press away
 * instead of in the way.
 */
export function GameSummaryRow({
  setupType,
  side,
  onChange,
}: GameSummaryRowProps) {
  const { t } = useTranslation()
  const opening = BOARD_SETUPS[setupType]

  return (
    <div className="flex items-center gap-3 rounded-xl bg-surface-2 py-1.5 ps-3 pe-1">
      <div className="size-10 shrink-0">
        <BoardThumb
          blackCells={opening.black.map(
            ([row, column]) => `${row},${column}`,
          )}
          whiteCells={opening.white.map(
            ([row, column]) => `${row},${column}`,
          )}
        />
      </div>

      <span className="block min-w-0 flex-1">
        <span className="block truncate font-display text-[15px] font-bold text-white">
          {getSetupName(setupType)}
        </span>
        <span className="block truncate text-[13px] text-muted">
          {t(`online:compose.side_summary.${side}`)}
        </span>
      </span>

      <Button
        variant="ghost"
        size="sm"
        className="font-display font-semibold text-brand-lighter"
        onClick={onChange}
      >
        {t("online:compose.change")}
      </Button>
    </div>
  )
}
