import type { GameState } from "@repo/abalone-engine/game-state"
import { cn } from "@repo/nativ/utils"
import type { ReactNode } from "react"
import { useRef } from "react"
import { useTranslation } from "react-i18next"
import {
  ChevronDoubleRightIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FlagIcon,
  LightbulbIcon,
  UndoIcon,
} from "@/components/icons"
import { MoveHistory, MoveStrip } from "@/components/move-history"
import { Button } from "@/components/ui/button"
import { TapButton } from "@/components/ui/tap-button"
import {
  LIST_BELOW,
  useCompactPanel,
  usePanelFits,
} from "@/hooks/use-compact-panel"

/** One slot of the action bar: icon over label, the whole thing a tap target. */
function Action({
  icon,
  label,
  onClick,
  disabled,
  busy,
  title,
}: {
  icon: ReactNode
  label: string
  onClick: () => void
  disabled?: boolean
  busy?: boolean
  title?: string
}) {
  return (
    <TapButton
      onClick={onClick}
      disabled={disabled}
      aria-busy={busy || undefined}
      title={title ?? label}
      className={cn(
        "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-lg py-1.5",
        "text-[0.6875rem] font-semibold text-muted transition",
        "hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
        "disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-muted",
        busy && "animate-pulse text-brand-light",
      )}
    >
      {icon}
      <span className="max-w-full truncate">{label}</span>
    </TapButton>
  )
}

export type IngameControlsProps = {
  state: GameState
  canPrev: boolean
  canNext: boolean
  canSkipToLatest: boolean
  canHint: boolean
  canUndo: boolean
  hintThinking: boolean
  marbleDesign?: string
  onPrev: () => void
  onNext: () => void
  onSkipToLatest: () => void
  onGoTo: (index: number) => void
  onHint: () => void
  onUndo: () => void
  onResign: () => void
}

/**
 * Move history, step-through navigation and the in-game actions. Whose turn it
 * is lives on the seats at the top of this panel, not here.
 *
 * Three layouts, and the panel's height picks between them. Given the room, the
 * history is a list with the step buttons under it. Short of that the step
 * buttons go — every move in the list is already a place to jump to, and they
 * are the one row here that says nothing the list doesn't — and the list keeps
 * the height they were taking. Shorter still, and the list itself has nowhere
 * left to stand, so it becomes a single scrolling line of chips.
 *
 * Only the last of those can leave the panel with height it isn't using, and
 * only a little: the list in the middle layout is a `flex-1`, so whatever the
 * board leaves over goes into moves you can see. That is the whole reason the
 * middle one exists — one line of chips over a hand's breadth of empty panel was
 * the alternative.
 */

export function IngameControls({
  state,
  canPrev,
  canNext,
  canSkipToLatest,
  canHint,
  canUndo,
  hintThinking,
  marbleDesign,
  onPrev,
  onNext,
  onSkipToLatest,
  onGoTo,
  onHint,
  onUndo,
  onResign,
}: IngameControlsProps) {
  const { t } = useTranslation()
  const panelRef = useRef<HTMLDivElement>(null)
  const compact = useCompactPanel(panelRef)
  const roomForList = usePanelFits(panelRef, LIST_BELOW)

  const history = {
    moveHistory: state.moveHistory,
    currentMoveIndex: state.currentMoveIndex,
    onGoTo,
    marbleDesign,
  }
  const list = (
    <MoveHistory
      {...history}
      className="min-h-0 flex-1 rounded-xl bg-surface-2 p-1"
    />
  )

  return (
    // The top padding is this column's own gap, not a margin of its own: the
    // strip of seats above it ends at its cards, and the space between them
    // should be the space between everything else stacked in here.
    <div
      ref={panelRef}
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-2 px-4 pt-2",
        compact ? "pb-safe-offset-2" : "pb-safe-offset-4",
      )}
    >
      {/* Nothing here says you are reviewing an earlier position. That notice
          lives on the board, which changes colour and captions itself — a
          banner in this column appeared and vanished on every step through the
          history, resizing the move list under it both ways. */}
      {compact ? (
        // One line, and its own height rather than a share of the panel's: this
        // is the layout for a panel with nothing to share.
        roomForList ? (
          list
        ) : (
          <MoveStrip
            {...history}
            className="h-10 shrink-0 rounded-xl bg-surface-2 px-1"
          />
        )
      ) : (
        <>
          {list}

          <div className="flex shrink-0 gap-2">
            <Button
              variant="secondary"
              className="flex-1"
              aria-label={t("game:controls.move_back_aria")}
              title={t("game:controls.move_back")}
              onClick={onPrev}
              disabled={!canPrev}
            >
              <ChevronLeftIcon size={22} />
            </Button>
            <Button
              variant="secondary"
              className="flex-1"
              aria-label={t("game:controls.move_forward_aria")}
              title={t("game:controls.move_forward")}
              onClick={onNext}
              disabled={!canNext}
            >
              <ChevronRightIcon size={22} />
            </Button>
            {/* Only worth showing once stepping forward would take several clicks. */}
            {canSkipToLatest && (
              <Button
                variant="secondary"
                className="flex-1"
                aria-label={t("game:controls.jump_to_latest_aria")}
                title={t("game:controls.jump_to_latest")}
                onClick={onSkipToLatest}
              >
                <ChevronDoubleRightIcon size={22} />
              </Button>
            )}
          </div>
        </>
      )}

      {/* A height of its own rather than its contents': it is the tallest thing
          the bottom of the panel ever holds, and what the list above is measured
          against, in this layout and after the game ends. Left to its contents
          that number is a line-height in a font, three pixels either way. */}
      <div className="flex h-16 shrink-0 gap-1 rounded-xl bg-surface-2 p-1">
        <Action
          icon={<FlagIcon size={20} />}
          label={t("game:controls.resign")}
          title={t("game:controls.resign_aria")}
          onClick={onResign}
          disabled={state.gameOver}
        />
        {/* Nothing to ask in hot-seat play — both players share the screen, so
            the engine's advice would be advice to the opponent too. Online
            there is no engine on this side of the board at all. */}
        {state.mode === "ai" && (
          <Action
            icon={<LightbulbIcon size={20} />}
            label={t("game:controls.hint")}
            title={t("game:controls.hint_aria")}
            onClick={onHint}
            disabled={!canHint}
            busy={hintThinking}
          />
        )}
        {/* A move played online is a move the other player has already been
            shown. There is nothing to take back that is still only yours. */}
        {state.mode !== "online" && (
          <Action
            icon={<UndoIcon size={20} />}
            label={t("game:controls.undo")}
            title={t("game:controls.undo_aria")}
            onClick={onUndo}
            disabled={!canUndo}
          />
        )}
      </div>
    </div>
  )
}
