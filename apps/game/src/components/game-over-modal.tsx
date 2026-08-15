import type { GameState } from "@repo/abalone-engine/game-state"
import { cn } from "@repo/nativ/utils"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { PlusIcon, RematchIcon } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { Sheet } from "@/components/ui/sheet"
import { getGameOverMessage } from "@/i18n/game-text"

/**
 * The one word above the result, and the only thing on this overlay that is
 * coloured by how it went. The heading stays white: a headline in red is a
 * telling-off, and losing a game of Abalone is not one.
 */
const EYEBROWS = {
  win: "text-brand-lighter",
  loss: "text-loss",
  draw: "text-faint",
}

export type ResultKind = keyof typeof EYEBROWS

/**
 * The game in one row, under the result — who it was against, what it was, and
 * how it finished.
 *
 * Only for a game with an opponent to name. Hot seat has two people at one
 * device and no card can say which of them just won.
 */
export type GameOverSummary = {
  /** Their face, if they have one. A bot's portrait, or an account's picture. */
  avatar?: ReactNode
  name: string
  /** The setup and the length, already worded and joined. */
  detail: string
  yourScore: number
  theirScore: number
}

export type GameOverModalProps = {
  open: boolean
  state: GameState
  /** Only read for the bot-flavoured heading, which `title` replaces. */
  difficulty?: number
  resultKind: ResultKind
  title?: string
  summary?: GameOverSummary
  /** What the first button says. The bot game's "Rematch", by default. */
  rematchLabel?: string
  onClose: () => void
  onRematch: () => void
  onNewBot: () => void
  newGameLabel: string
}

/**
 * The result, shown over the board the moment the game ends.
 *
 * Three blocks and they are in the order they are read: what happened, the game
 * it happened in, and the two ways on from here. The result itself is the
 * largest type in the app — it is one line, it is read once, and everything
 * else on this overlay is there to be looked at after it.
 */
export function GameOverModal({
  open,
  state,
  difficulty = 1,
  resultKind,
  title,
  summary,
  rematchLabel,
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
    <Sheet open={open} onClose={onClose} className="lg:max-w-[456px]">
      <div className="text-center">
        <span
          className={cn(
            "font-display text-[11px] font-bold tracking-[0.22em] uppercase",
            EYEBROWS[resultKind],
          )}
        >
          {t("game:modal.game_over")}
        </span>

        <p className="mt-2.5 font-display text-4xl leading-none font-extrabold tracking-[-0.035em] text-white lg:mt-3 lg:text-[44px]">
          {heading}
        </p>

        <p className="mt-2 text-sm text-muted lg:text-[15px]">{subtext}</p>
      </div>

      {summary && <ResultCard summary={summary} resultKind={resultKind} />}

      <div className="mt-5 flex gap-2.5 lg:mt-[18px]">
        <Button
          variant="primary"
          className="h-[50px] flex-1 rounded-xl font-display text-base"
          onClick={onRematch}
        >
          <RematchIcon size={18} />
          {rematchLabel ??
            (mode === "local"
              ? t("game:controls.rematch")
              : t("game:modal.rematch_button"))}
        </Button>
        <Button
          variant="outline"
          className="h-[50px] flex-1 rounded-xl font-display text-base text-subtle hover:text-white"
          onClick={onNewBot}
        >
          <PlusIcon size={18} />
          {newGameLabel}
        </Button>
      </div>
    </Sheet>
  )
}

/**
 * The winner's score first and in white, the loser's after it and set back.
 *
 * Not "yours then theirs". A scoreline is read as a result, and a result reads
 * the way it is said out loud — six four to Theo, not four six to you.
 */
function ResultCard({
  summary,
  resultKind,
}: {
  summary: GameOverSummary
  resultKind: ResultKind
}) {
  const { avatar, name, detail, yourScore, theirScore } = summary
  const lost = resultKind === "loss"
  const [first, second] = lost
    ? [theirScore, yourScore]
    : [yourScore, theirScore]

  return (
    <div className="mt-6 flex items-center gap-3.5 rounded-[14px] bg-well px-4 py-3.5 lg:mt-[22px]">
      <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-avatar-well">
        {avatar}
      </span>

      <span className="block min-w-0 flex-1 text-start">
        <span className="block truncate text-base font-semibold text-white">
          {name}
        </span>
        <span className="mt-0.5 block truncate text-[13px] text-faint">
          {detail}
        </span>
      </span>

      <span className="flex shrink-0 items-baseline gap-1.5 font-display tabular-nums">
        <span className="text-[26px] font-bold text-white">{first}</span>
        <span className="text-[15px] text-faint">–</span>
        <span className="text-[26px] font-bold text-faint">{second}</span>
      </span>
    </div>
  )
}
