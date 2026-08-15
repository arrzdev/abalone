import { cn } from "@repo/nativ/utils"
import type { CSSProperties } from "react"
import { useTranslation } from "react-i18next"
import { FACE_CENTER } from "@/components/seat-bar"
import { blurbKey } from "@/i18n/bots"

/**
 * The bot's voice: a speech bubble under the scoreboard at the top of the panel.
 *
 * It goes in the panel because the board column has nothing to spare. That
 * column is sized so the board comes out as large as the screen allows, and
 * anything added beside the board comes straight out of the board. The panel is
 * a fixed 380px the board never competes with, so a strip at the top of it costs
 * the board nothing.
 *
 * Only the voice. This used to be the bot's whole seat as well — its portrait,
 * its name, and the marbles either side had pushed off, none of which the panel
 * had anywhere else to put. The scoreboard above now carries all of it, for both
 * players and in both modes, and a second copy of the same face 8px under the
 * first was the strip's own argument against keeping it.
 *
 * What is left points at the face instead: the tail is on top, over the bot's
 * end of the card, so the bubble belongs to somebody without having to draw them
 * twice. It also buys the line the full width of the panel, which is what a
 * fixed two rows of room is measured against.
 *
 * The height is fixed rather than grown from the text. Lines run from one word
 * to two full rows, and a bubble that resized on each of them would shunt the
 * move list down and up all game.
 */

/** Half the tail, in px — a 12px square stood on its corner. */
const TAIL = 6

export type BotChatterProps = {
  level: number
  line: string | null
  side?: "left" | "right"
}

export function BotChatter({
  level,
  line,
  side = "left",
}: BotChatterProps) {
  const { t } = useTranslation()
  // Before the first line lands there is still a bubble to fill, and an empty
  // one reads as broken. The character's own one-liner holds the space until it
  // speaks, set back so it is plainly not something it just said.
  const resting = !line

  return (
    // No bottom padding, and a top gap that matches every other gap in here: the
    // card above is what this points at, and the tail is what closes the last
    // few pixels of it.
    <div className="shrink-0 px-4 pt-2">
      <div className="relative flex h-12 items-center rounded-xl bg-elevated px-3">
        {/* What makes this read as speech rather than as one more panel row —
            the fill on its own is too close to the furniture around it. A square
            turned on its corner, tucked behind the bubble so only the half that
            sticks out shows, under whichever end of the scoreboard is the bot's. */}
        <span
          aria-hidden="true"
          className="absolute -top-1 h-3 w-3 rotate-45 rounded-[2px] bg-elevated"
          style={{ [side]: FACE_CENTER - TAIL } as CSSProperties}
        />
        {/* Two rows of room, always, and never a third: the longest line in the
            roster wraps to two at this width, and the clamp is what guarantees
            the strip cannot grow if a later one runs longer. */}
        <span
          aria-live="polite"
          className={cn(
            "line-clamp-2 text-sm leading-snug",
            resting ? "text-faint italic" : "text-white",
          )}
        >
          {t(line ?? blurbKey(level))}
        </span>
      </div>
    </div>
  )
}
