import { cn } from "@repo/nativ/utils"
import { barFraction, DECIDED } from "@/utils/evaluation"

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
 * way, and it lines up with the board it belongs to.
 *
 * Black on the left is the order the seats use and the order the move list uses.
 *
 * The number is an advantage in marbles, which is what the score already means
 * — a captured marble is worth 1 and every positional term is a fraction of
 * one. It is capped at six because six is the game: past that the position is
 * not an advantage but a result, and the bar is already full.
 */

/**
 * The same reading stood on end, fused to the panel's leading edge.
 *
 * Beside the board it had to be as wide as the board and it ended the board's
 * column, which is why it was laid down in the first place. Against the panel
 * it costs neither: the panel is a fixed width, the board beside it is bound by
 * height, and a bar that runs the panel's full height is a bar you can read
 * from across the room. Black at the top, because the panel reads downward and
 * black is first everywhere else in this app.
 *
 * No number on it. Eighteen pixels is a bar, not a label — the figure is on the
 * element itself, for a pointer and for a screen reader.
 */
export function EvalColumn({
  score,
  label,
  className,
}: {
  score: number
  /** The advantage in words. The column has nowhere to write it. */
  label: string
  className?: string
}) {
  const value = Number.isFinite(score) ? score : 0
  const black = barFraction(value) * 100

  return (
    <div
      //a picture with a caption: the bar is the whole reading, and `label` is
      //that reading in words for anyone the picture is no use to
      role="img"
      title={label}
      aria-label={label}
      className={cn(
        "relative w-[18px] shrink-0 overflow-hidden rounded-s-[9px] bg-surface-2",
        className,
      )}
    >
      {/* Both shares are drawn, and neither is the box's own fill. A layer
          squashed from the top with `scaleY` is a transform, and a transform is
          composited — which takes the rounded clip off the paint pass and onto
          the compositor, where it lands as a hard-edged mask and leaves a
          hairline down the capped side. Two heights meeting in the middle is
          the same picture with nothing promoted, and it is what the horizontal
          bar below already does.

          The track behind them is only ever a sub-pixel of itself, where the
          two are mid-transition and have not quite met. */}
      <div
        className="absolute inset-x-0 top-0 bg-marble-black transition-[height] duration-300 ease-out"
        style={{ height: `${black}%` }}
      />
      <div
        className="absolute inset-x-0 bottom-0 bg-marble-white transition-[height] duration-300 ease-out"
        style={{ height: `${100 - black}%` }}
      />
    </div>
  )
}

/**
 * The column's slot, held open whether or not there is a bar in it.
 *
 * The board sizes itself to whatever is left of the row, so a rail that came and
 * went would resize the board with it — leaving pregame for a bot game, or
 * turning the setting off mid-game, would move every marble on the screen. The
 * eighteen pixels are cheap and the board staying still is not.
 *
 * Desktop only. Below `lg` the panel is the whole screen and the reading lies
 * down under the board instead.
 */
export function EvalRail({
  score,
  label,
}: {
  /** No score means an empty rail: the slot stays, the bar is not drawn. */
  score?: number
  label?: string
}) {
  return (
    <div className="w-[18px] shrink-0 max-lg:hidden">
      {score !== undefined && label !== undefined && (
        <EvalColumn score={score} label={label} className="h-full" />
      )}
    </div>
  )
}

export function EvalBar({
  score,
  className,
}: {
  score: number
  className?: string
}) {
  const value = Number.isFinite(score) ? score : 0
  const white = (1 - barFraction(value)) * 100
  const favoursBlack = value >= 0
  const shown = Math.min(Math.abs(value), DECIDED)

  return (
    <div
      className={cn(
        "relative h-5 w-(--board-w) shrink-0 overflow-hidden rounded-md bg-marble-black",
        className,
      )}
    >
      <div
        className="absolute inset-y-0 right-0 bg-marble-white transition-[width] duration-300 ease-out"
        style={{ width: `${white}%` }}
      />
      {/* On the winning side's own end of the bar, in the colour that side is
          not — the fill under it is theirs, so the number has to be the other
          one to be read at all. */}
      <span
        className={cn(
          "absolute inset-y-0 flex items-center px-2 text-[0.7rem] font-bold tabular-nums",
          favoursBlack ? "left-0 text-white" : "right-0 text-black",
        )}
      >
        {shown.toFixed(1)}
      </span>
    </div>
  )
}
