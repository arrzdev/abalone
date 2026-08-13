import { DECIDED, barFraction } from '../lib/evaluation.js';
import { cn } from '../lib/cn.js';

/**
 * Evaluation bar: how the position stands, black on the left.
 *
 * A bar of two colours says who is winning by which of them there is more of —
 * that is the whole reading, and it has to be the obvious one. So black's share
 * grows in from the left and white's in from the right, and the side that is
 * ahead is the side filling the bar. `barFraction` answers for black, so what is
 * painted is white's share of what is left.
 *
 * Left and right rather than bottom and top, and under the board rather than
 * beside it. Standing on end it had to be as tall as the board and take a column
 * of its own, which on a phone is width the board cannot spare and on a desktop
 * is width taken off a board bound by height. Lying down it costs a strip either
 * way, and it lines up with the board and the cards above it.
 *
 * Black on the left is the order the cards use and the order the move list uses.
 *
 * The number is an advantage in marbles, which is what the score already means
 * — a captured marble is worth 1 and every positional term is a fraction of
 * one. It is capped at six because six is the game: past that the position is
 * not an advantage but a result, and the bar is already full.
 */

/**
 * The strip the bar takes, without the bar — pregame's stand-in for it, the same
 * trick `PlayerCardSlot` plays for the cards.
 *
 * The board is bound by height on a desktop, so a bar appearing under it is a
 * board getting smaller. Holding the space through pregame is what keeps the
 * preview the size of the game it previews.
 */
export function EvalBarSlot({ className }) {
  return <div aria-hidden="true" className={cn('h-5 w-full shrink-0', className)} />;
}

export function EvalBar({ score }) {
  const value = Number.isFinite(score) ? score : 0;
  const white = (1 - barFraction(value)) * 100;
  const favoursBlack = value >= 0;
  const shown = Math.min(Math.abs(value), DECIDED);

  return (
    <div className="relative h-5 w-(--board-w) shrink-0 overflow-hidden rounded-md bg-marble-black">
      <div
        className="absolute inset-y-0 right-0 bg-marble-white transition-[width] duration-300 ease-out"
        style={{ width: `${white}%` }}
      />
      {/* On the winning side's own end of the bar, in the colour that side is
          not — the fill under it is theirs, so the number has to be the other
          one to be read at all. */}
      <span
        className={cn(
          'absolute inset-y-0 flex items-center px-2 text-[0.7rem] font-bold tabular-nums',
          favoursBlack ? 'left-0 text-white' : 'right-0 text-black',
        )}
      >
        {shown.toFixed(1)}
      </span>
    </div>
  );
}
