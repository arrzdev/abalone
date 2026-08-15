import type { GameState } from "@repo/abalone-engine/game-state"
import { cn } from "@repo/nativ/utils"
import { useTranslation } from "react-i18next"
import { PlusIcon, RematchIcon } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { Sheet } from "@/components/ui/sheet"
import { getGameOverMessage } from "@/i18n/game-text"

const ACCENTS = {
  win: "text-brand-light",
  loss: "text-loss",
  draw: "text-white",
}

export type ResultKind = keyof typeof ACCENTS

export type GameOverModalProps = {
  open: boolean
  state: GameState
  difficulty: number
  resultKind: ResultKind
  title?: string
  onClose: () => void
  onRematch: () => void
  onNewBot: () => void
  newGameLabel: string
}

/** Result dialog shown when the game ends. */
export function GameOverModal({
  open,
  state,
  difficulty,
  resultKind,
  title,
  onClose,
  onRematch,
  onNewBot,
  newGameLabel,
}: GameOverModalProps) {
  const { t } = useTranslation()
  if (!open) return null

  const {
    gameOverReason,
    blackScore,
    whiteScore,
    winner,
    playerColor,
    mode,
  } = state

  // For hot-seat games the AI-flavoured copy does not apply, so a plain
  // "<colour> wins" title is passed in from the page instead.
  const heading =
    title ??
    getGameOverMessage(
      t,
      winner === null ? null : winner === playerColor ? "player" : "ai",
      difficulty,
    ).title

  let subtext: string
  if (gameOverReason === "resignation") {
    subtext = t("game:modal.by_resignation")
  } else if (gameOverReason === "threefold_repetition") {
    subtext = t("game:modal.by_repetition")
  } else {
    subtext = `${blackScore} – ${whiteScore}`
  }

  return (
    <Sheet open={open} onClose={onClose} className="text-center">
      <p className={cn("text-3xl font-extrabold", ACCENTS[resultKind])}>
        {heading}
      </p>
      <p className="mt-1 text-sm text-white/50">{subtext}</p>

      <div className="mt-6 flex gap-3">
        <Button variant="primary" className="flex-1" onClick={onRematch}>
          <RematchIcon size={20} />
          {mode === "local"
            ? t("game:controls.rematch")
            : t("game:modal.rematch_button")}
        </Button>
        <Button variant="secondary" className="flex-1" onClick={onNewBot}>
          <PlusIcon size={20} />
          {newGameLabel}
        </Button>
      </div>
    </Sheet>
  )
}
