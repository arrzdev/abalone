import { cn } from "@repo/nativ/utils"
import type { ReactNode, RefObject } from "react"
import { Fragment, useEffect, useMemo, useRef } from "react"
import { useTranslation } from "react-i18next"
import { MarbleGlyph } from "@/components/marble-glyph"
import { TapButton } from "@/components/ui/tap-button"
import type { HistoryEntry, MoveDetails } from "@/engine/game-state"
import { formatMoveAlgebraic } from "@/engine/notation"
import type { Player } from "@/engine/types"
import { useScrollEdges } from "@/hooks/use-scroll-edges"
import type { ScrollAxis } from "@/hooks/use-sticky-end"
import { useStickyEnd } from "@/hooks/use-sticky-end"

/** How the game ended, as the foot of the record says it. */
export type GameResult = {
  winner: Player | null
  label: string
}

type RecordProps = {
  moveHistory: HistoryEntry[]
  currentMoveIndex: number
  onGoTo: (index: number) => void
  marbleDesign?: string
  result?: GameResult | null
  className?: string
}

/** Marble-count dots + notation + push/capture markers for a single move. */
function MoveContent({
  details,
  marbleDesign,
}: {
  details: MoveDetails
  marbleDesign?: string
}): ReactNode {
  const { t } = useTranslation()
  const notation = formatMoveAlgebraic(
    details.marbles,
    details.destination,
  )
  if (!notation) return t("game:history.move")

  const count = details.marbleCount || details.marbles.length
  // A capture always costs the side that was pushed, so the marble that left
  // the board is the mover's opposite.
  const capturedColor = details.color === "white" ? "black" : "white"

  return (
    <span className="flex items-center gap-1.5">
      <span
        className="flex gap-px"
        title={t("game:history.marbles_moved", { n: count })}
      >
        {Array.from({ length: count }, (_, i) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: the dots are a count, not a list of things — there is nothing else to key them by.
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-current opacity-50"
          />
        ))}
      </span>
      <span className="font-mono">{notation}</span>
      {details.isPush && (
        <span
          className="text-brand-light"
          title={t("game:history.pushed")}
        >
          ▸
        </span>
      )}
      {/* The marble that was knocked off, in the design the player is using —
          the marble itself says both that a capture happened and to whom, so
          there is nothing left for a "−1" to add. */}
      {details.isCapture && (
        <MarbleGlyph
          color={capturedColor}
          design={marbleDesign}
          size={11}
          title={t("game:history.captured")}
        />
      )}
    </span>
  )
}

/**
 * The same move, trimmed for the strip. The marble-count dots go: in a line
 * this narrow the notation already says which marbles moved, and the width they
 * cost is a whole extra move you could have seen.
 *
 * What replaces them is the mover's own marble. The list says whose move it was
 * by which column it sits in, and a single line has no columns.
 */
function StripContent({
  details,
  marbleDesign,
}: {
  details: MoveDetails
  marbleDesign?: string
}): ReactNode {
  const { t } = useTranslation()
  const notation = formatMoveAlgebraic(
    details.marbles,
    details.destination,
  )
  if (!notation) return t("game:history.move")

  const capturedColor = details.color === "white" ? "black" : "white"

  return (
    <>
      <MarbleGlyph color={details.color} design={marbleDesign} size={10} />
      <span className="font-mono">{notation}</span>
      {details.isPush && (
        <span
          className="text-brand-light"
          title={t("game:history.pushed")}
        >
          ▸
        </span>
      )}
      {details.isCapture && (
        <MarbleGlyph
          color={capturedColor}
          design={marbleDesign}
          size={11}
          title={t("game:history.captured")}
        />
      )}
    </>
  )
}

/**
 * Where the record should be looking, after whatever has just changed. Shared
 * by both of its renderings — the list runs down and the strip runs across, and
 * that is the whole of the difference between them here.
 *
 * Three things move it, and they are not the same kind of thing:
 *
 * A move is played. The record grows at its end, and it follows — but only for
 * a reader who was standing at that end. Someone who has gone back to look at
 * the opening is reading, and a game against a bot would otherwise drag them
 * out of it twice a minute. That is `useStickyEnd`, and it is the same bargain
 * a chat window makes.
 *
 * The game ends. The result is written under the last move, and it is the one
 * line worth interrupting a reader for, so this one goes to the foot from
 * wherever they were. It is also the reason a scroll to the *move* is not
 * enough on its own: `nearest` is done the moment the row it was handed is on
 * screen, which is one line short of the line that says how the game ended.
 * Hence the third case below — coming back to the final position of a finished
 * game means the result, not the move before it.
 *
 * Somewhere is asked for: a row tapped, a step back, a jump to the latest.
 * Nothing was added and nobody was interrupted; the reader asked to be
 * somewhere, and all this has to do is put it on screen.
 */
function useRecordScroll(
  ref: RefObject<HTMLElement | null>,
  {
    entries,
    current,
    ended,
    axis = "y",
  }: {
    entries: number
    current: number
    ended: boolean
    axis?: ScrollAxis
  },
) {
  const { follow, followIfPinned } = useStickyEnd(ref, entries, axis)
  // What the last run of this saw, so that a change can be told from a redraw.
  // It starts at nothing, which makes a fresh box a box that has just been
  // filled — and a record opened at its end is the right way round to open one.
  const seenRef = useRef({ entries: 0, ended: false })

  useEffect(() => {
    const box = ref.current
    if (!box) return

    const seen = seenRef.current
    seenRef.current = { entries, ended }

    if (ended && !seen.ended) {
      follow()
    } else if (entries !== seen.entries) {
      followIfPinned()
    } else if (ended && current === entries - 1) {
      follow()
    } else {
      box.querySelector('[data-current="true"]')?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: axis === "x" ? "center" : "nearest",
      })
    }
  }, [axis, current, ended, entries, follow, followIfPinned, ref])
}

/**
 * The whole history on one scrolling line, for a panel too short to show a list
 * worth reading — which on a phone is every panel, once the browser's own
 * chrome has taken its share of the screen.
 *
 * Nothing sits beside it: the strip *is* the step navigation. Back and forward
 * buttons walk the history one move per tap, and a scroller you can flick and
 * tap does the same job in one gesture.
 */
export function MoveStrip({
  moveHistory,
  currentMoveIndex,
  onGoTo,
  marbleDesign,
  result,
  className,
}: RecordProps) {
  const { t } = useTranslation()
  const stripRef = useRef<HTMLDivElement>(null)

  // Entry 0 is the starting position, so the moves start at index 1.
  const moves = useMemo(
    () =>
      moveHistory.slice(1).map((entry, i) => ({ entry, index: i + 1 })),
    [moveHistory],
  )

  useRecordScroll(stripRef, {
    entries: moveHistory.length,
    current: currentMoveIndex,
    ended: Boolean(result),
    axis: "x",
  })

  // A game can end before anyone has moved — resign on move one — and then the
  // result is the only thing the record has to say. It still has to say it.
  if (moves.length === 0 && !result) {
    return (
      <div
        className={cn(
          "flex items-center justify-center text-sm text-white/30",
          className,
        )}
      >
        {t("game:history.empty")}
      </div>
    )
  }

  return (
    <div className={cn("overflow-hidden", className)}>
      <div
        ref={stripRef}
        className="strip-scroll flex h-full items-center gap-1 overflow-x-auto"
      >
        {/* Same reason as the list: step back past the first move and this is
            where you land, so it has to be somewhere the strip can light up. */}
        <TapButton
          data-current={currentMoveIndex === 0}
          aria-current={currentMoveIndex === 0 || undefined}
          onClick={() => onGoTo(0)}
          className={cn(
            // One weight for every chip, lit or not. The strip is a row of boxes
            // measured by their text, so bolding the one you land on makes it
            // wider and shoves the rest of the game sideways under your thumb.
            // The fill is what marks it; the weight never was.
            "shrink-0 rounded-md px-2 py-1 text-sm font-semibold transition",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
            currentMoveIndex === 0
              ? "bg-brand text-white"
              : "text-white/50 hover:bg-white/5 hover:text-white",
          )}
        >
          {t("game:history.start")}
        </TapButton>

        {moves.map(({ entry, index }) => (
          <Fragment key={index}>
            {/* Numbered once per pair, on the move that opens it. */}
            {index % 2 === 1 && (
              <span className="shrink-0 pl-1 text-xs text-white/30 tabular-nums">
                {Math.floor((index + 1) / 2)}.
              </span>
            )}
            <TapButton
              data-current={index === currentMoveIndex}
              aria-current={index === currentMoveIndex || undefined}
              onClick={() => onGoTo(index)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-sm font-semibold transition",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
                index === currentMoveIndex
                  ? "bg-brand text-white"
                  : "text-white/70 hover:bg-white/5 hover:text-white",
              )}
            >
              {entry.moveDetails?.marbles ? (
                <StripContent
                  details={entry.moveDetails}
                  marbleDesign={marbleDesign}
                />
              ) : (
                t("game:history.move")
              )}
            </TapButton>
          </Fragment>
        ))}

        {result && (
          <ResultLine
            result={result}
            marbleDesign={marbleDesign}
            className="shrink-0 px-2 text-sm"
          />
        )}
      </div>
    </div>
  )
}

/**
 * How the game ended, written at the foot of the record.
 *
 * It names the side rather than the player: the two cards framing the board
 * already say who is which colour, and a record that says "you won" is only
 * true for one of the two people who might be reading it. Naming the colour is
 * also the one phrasing that needs nothing to be true of the game — it reads
 * the same against a bot, across a table, or over a network.
 *
 * Not something you can click. Every other entry in the history is a position
 * to go to and lights up when you are standing on it; the result is not a
 * position, and dressing it as one would offer a place to go that does not
 * exist.
 */
function ResultLine({
  result,
  marbleDesign,
  className,
}: {
  result: GameResult
  marbleDesign?: string
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-center gap-1.5 font-semibold text-white/70",
        className,
      )}
    >
      {result.winner && (
        <MarbleGlyph
          color={result.winner}
          design={marbleDesign}
          size={11}
        />
      )}
      {result.label}
    </div>
  )
}

/**
 * The position before anyone had moved, as somewhere you can be.
 *
 * It is entry 0 of the history and always has been — you could already rewind to
 * it — but nothing in the list stood for it, so stepping back that last move
 * left every row unlit and no way to tell where you were.
 */
function StartRow({
  current,
  onGoTo,
}: {
  current: boolean
  onGoTo: (index: number) => void
}) {
  const { t } = useTranslation()
  return (
    // Every other entry is a cell sitting inside a padded row, which is where
    // its rounding has room to show. This one is a row in its own right, so it
    // carries that row's padding itself rather than running to the edges.
    <div className="border-b border-white/5 px-1 py-0.5">
      <TapButton
        data-current={current}
        aria-current={current || undefined}
        onClick={() => onGoTo(0)}
        className={cn(
          // Same one weight as the strip, for the same reason and so the two
          // renderings of one list read alike.
          "block w-full rounded-md px-2 py-1 text-left text-sm font-semibold transition",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
          current
            ? "bg-brand text-white"
            : "text-white/50 hover:bg-white/5 hover:text-white",
        )}
      >
        {t("game:history.start")}
      </TapButton>
    </div>
  )
}

function MoveCell({
  entry,
  index,
  currentIndex,
  onGoTo,
  marbleDesign,
}: {
  entry: HistoryEntry | null
  index: number
  currentIndex: number
  onGoTo: (index: number) => void
  marbleDesign?: string
}) {
  const { t } = useTranslation()
  if (!entry) return <div className="flex-1" />

  const isCurrent = index === currentIndex
  return (
    <TapButton
      onClick={() => onGoTo(index)}
      aria-current={isCurrent || undefined}
      className={cn(
        "flex-1 rounded-md px-2 py-1 text-left text-sm font-semibold transition",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
        isCurrent
          ? "bg-brand text-white"
          : "text-white/70 hover:bg-white/5 hover:text-white",
      )}
    >
      {entry.moveDetails?.marbles ? (
        <MoveContent
          details={entry.moveDetails}
          marbleDesign={marbleDesign}
        />
      ) : (
        t("game:history.move")
      )}
    </TapButton>
  )
}

/**
 * Move list, paired black/white per row. Entry 0 of moveHistory is the starting
 * position, so pairing starts at index 1.
 */
export function MoveHistory({
  moveHistory,
  currentMoveIndex,
  onGoTo,
  marbleDesign,
  result,
  className,
}: RecordProps) {
  const { t } = useTranslation()
  const listRef = useRef<HTMLDivElement>(null)

  const pairs = useMemo(() => {
    const rows = []
    for (let i = 1; i < moveHistory.length; i += 2) {
      rows.push({
        moveNumber: Math.floor(i / 2) + 1,
        blackIndex: i,
        black: moveHistory[i],
        whiteIndex: i + 1,
        white: moveHistory[i + 1] || null,
      })
    }
    return rows
  }, [moveHistory])

  useRecordScroll(listRef, {
    entries: moveHistory.length,
    current: currentMoveIndex,
    ended: Boolean(result),
  })

  const edges = useScrollEdges(listRef, pairs.length)

  // See `MoveStrip`: a resignation on move one is a record with a result and
  // nothing else in it.
  if (pairs.length === 0 && !result) {
    return (
      <div
        className={cn(
          "flex items-center justify-center text-sm text-white/30",
          className,
        )}
      >
        {t("game:history.empty")}
      </div>
    )
  }

  return (
    // The caller's rounding sits on the outer box and the scrolling on the
    // inner one: an overlay scrollbar is painted over the corners of the
    // element it scrolls, squaring off the side it runs down.
    <div className={cn("relative overflow-hidden", className)}>
      <div ref={listRef} className="panel-scroll h-full overflow-y-auto">
        <StartRow current={currentMoveIndex === 0} onGoTo={onGoTo} />
        {/* Every pair keeps its rule now that the result is what sits last, so
            the record is closed off by a line before the line that reads it. */}
        {pairs.map((pair) => (
          <div
            key={pair.blackIndex}
            data-current={
              pair.blackIndex === currentMoveIndex ||
              pair.whiteIndex === currentMoveIndex
            }
            className="flex items-center gap-1 border-b border-white/5 px-1 py-0.5 last:border-b-0"
          >
            <span className="w-7 shrink-0 text-right text-xs text-white/30 tabular-nums">
              {pair.moveNumber}.
            </span>
            <MoveCell
              entry={pair.black}
              index={pair.blackIndex}
              currentIndex={currentMoveIndex}
              onGoTo={onGoTo}
              marbleDesign={marbleDesign}
            />
            <MoveCell
              entry={pair.white}
              index={pair.whiteIndex}
              currentIndex={currentMoveIndex}
              onGoTo={onGoTo}
              marbleDesign={marbleDesign}
            />
          </div>
        ))}

        {result && (
          <ResultLine
            result={result}
            marbleDesign={marbleDesign}
            className="px-1 py-2 text-sm"
          />
        )}
      </div>

      {/* The list is one of the few boxes here that can hold more than it shows,
          and nothing said so — a row cut exactly at the edge looks like the last
          row. These are that and no more: a few pixels of the box's own colour
          lying over the content, so the row under them goes soft instead of
          stopping. Each end shows only while there is something past it, so a
          list scrolled to the bottom plainly is at the bottom.

          After the list rather than before it. Both would paint over it — a
          positioned box outranks its in-flow siblings whatever the order — but
          the order they are read in should be the order they are drawn in. */}
      <EdgeFade className="top-0 bg-linear-to-b" visible={edges.top} />
      <EdgeFade
        className="bottom-0 bg-linear-to-t"
        visible={edges.bottom}
      />
    </div>
  )
}

/**
 * One end of a scrolling box, fading out.
 *
 * A share of the box rather than a fixed depth: an eighth of a tall list is a
 * soft edge, and the same measurement on a phone's four rows would be half the
 * list under a haze. So it is 12% of whatever the box turns out to be, floored
 * at 14px — under that it stops reading as a fade and starts reading as a smudge
 * — and capped at 28px, which is about one row: past that it is a row you can't
 * read rather than an edge you can see over.
 *
 * It takes no layout — the list is the same size with it and without it — and no
 * taps: it lies over rows that are still there to be pressed.
 *
 * `from-surface-4` is the box's own fill, which is what makes this read as the
 * content running under an edge rather than as a band drawn across it.
 */
function EdgeFade({
  visible,
  className,
}: {
  visible: boolean
  className?: string
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-x-0 from-surface-4 to-transparent",
        "h-[clamp(0.875rem,12%,1.75rem)]",
        "transition-opacity duration-200",
        visible ? "opacity-100" : "opacity-0",
        className,
      )}
    />
  )
}
