import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { MoveHistory, MoveStrip } from './MoveHistory.jsx';
import { LIST_BELOW, useCompactPanel, usePanelFits } from '../hooks/useCompactPanel.js';
import { Button } from './ui/Button.jsx';
import {
  ChevronDoubleRightIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  RematchIcon,
} from './Icons.jsx';
import { cn } from '../lib/cn.js';

/**
 * Move review plus rematch / new-opponent once the game has ended.
 *
 * The same three layouts as the in-game panel, off the same measurement: the
 * two buttons are the row the in-game actions were, at the same height, and the
 * history above them keeps whatever the panel has over — the list where two
 * rows of it fit, the strip where they don't. The end of a game is where you
 * are most likely to want to read the game back, so it is the last thing that
 * should lose room; and a panel that rearranges itself on the final move,
 * having stood still all game, reads as something having gone wrong.
 *
 * How the game ended is not up here: it is the last line of the move history,
 * where the rest of the game already is. A banner over the record said the same
 * thing the modal had just said, in the one place that was already short of
 * room.
 */
export function PostgameControls({
  state,
  result,
  canPrev,
  canNext,
  canSkipToLatest,
  marbleDesign,
  onPrev,
  onNext,
  onSkipToLatest,
  onGoTo,
  onRematch,
  onNewBot,
  newGameLabel,
}) {
  const { t } = useTranslation();
  const panelRef = useRef(null);
  const compact = useCompactPanel(panelRef);
  const roomForList = usePanelFits(panelRef, LIST_BELOW);

  const history = { moveHistory: state.moveHistory, currentMoveIndex: state.currentMoveIndex, onGoTo, marbleDesign, result };
  const list = <MoveHistory {...history} className="min-h-0 flex-1 rounded-xl bg-surface-4 p-1" />;

  return (
    <div
      ref={panelRef}
      className={cn('flex min-h-0 flex-1 flex-col px-4', compact ? 'gap-2 py-2' : 'gap-3 py-4')}
    >
      {compact ? (
        // One line, and its own height rather than a share of the panel's: this
        // is the layout for a panel with nothing to share.
        roomForList ? list : <MoveStrip {...history} className="h-10 shrink-0 rounded-xl bg-surface-4 px-1" />
      ) : (
        <>
          {list}

          <div className="flex shrink-0 gap-2">
            <Button
              variant="secondary"
              className="flex-1"
              aria-label={t('game:controls.move_back_aria')}
              title={t('game:controls.move_back')}
              onClick={onPrev}
              disabled={!canPrev}
            >
              <ChevronLeftIcon size={22} />
            </Button>
            <Button
              variant="secondary"
              className="flex-1"
              aria-label={t('game:controls.move_forward_aria')}
              title={t('game:controls.move_forward')}
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
                aria-label={t('game:controls.jump_to_latest_aria')}
                title={t('game:controls.jump_to_latest')}
                onClick={onSkipToLatest}
              >
                <ChevronDoubleRightIcon size={22} />
              </Button>
            )}
          </div>
        </>
      )}

      {/* These two are what the screen is for once the game is over, so they sit
          where the hand already is: the bottom row, side by side, in place of
          the bar of in-game actions. Stacked and stretched they took the panel's
          spare height and looked like two doors — and the spare height is worth
          more to the moves above them, which is where you look after a game
          rather than before the next one.

          A little under the bar they replace: two words on one line need less
          height than an icon over a label, and the difference goes to the list.
          The panel is not measured any tighter for it — the layout switch above
          stays where the in-game bar puts it, so the list can't appear or vanish
          on account of the game having ended. */}
      <div className={cn('flex shrink-0 gap-2', compact && 'h-14')}>
        <Button
          variant="primary"
          size={compact ? 'fill' : 'md'}
          className="flex-1"
          aria-label={t('game:controls.rematch_aria')}
          onClick={onRematch}
        >
          <RematchIcon size={20} />
          {t('game:controls.rematch')}
        </Button>
        <Button
          variant="secondary"
          size={compact ? 'fill' : 'md'}
          className="flex-1"
          aria-label={t('game:controls.new_bot_aria')}
          onClick={onNewBot}
        >
          <PlusIcon size={20} />
          {newGameLabel}
        </Button>
      </div>
    </div>
  );
}
