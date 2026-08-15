import { WINNING_SCORE } from "@repo/abalone-engine/config"
import type { Player } from "@repo/abalone-engine/types"
import { cn } from "@repo/nativ/utils"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { PersonIcon } from "@/components/icons"
import { MarbleGlyph } from "@/components/marble-glyph"

/**
 * Both players, at the top of the panel: one card with a face and a name at
 * either end and the score between them.
 *
 * A scoreboard, because that is what anyone looking at a game in progress is
 * looking for. The pair used to be two cards, each spelling out its own colour
 * and its own count in words — which is a form, and read as one. Here the two
 * figures sit a thumb apart in the middle and are read against each other
 * without a word on either, the way a score is read anywhere else.
 *
 * It is the same card in both modes. Against a bot the opponent's end carries
 * that bot's portrait and its name, and the near end is "You" until accounts
 * make it something better — the bot used to keep its own strip with the score
 * tucked into the corner of it, which meant a game against a bot and a game
 * across a table were read two different ways for no reason anyone could see.
 *
 * Which marbles are whose is a badge hung off the corner of each face, so no
 * line of the card has to say it. The two sides mirror about the middle, so each
 * player's own face is at their own end.
 *
 * Whose move it is is the one thing left to draw, and it is drawn twice: a blue
 * ring around that player's face, and their name in white against the other's
 * grey. Asked for in that shape — a whole card going blue reads as a control
 * that has been switched on, but a ring on the one face you are looking for does
 * not, and it is the one thing on this card that has to carry across a table.
 *
 * The card itself stays one flat grey, both ends alike. Lighting the player's
 * end as well was a third way of saying the same thing, and it broke the card in
 * half to say it.
 */

/** Portrait size, in px. */
const PORTRAIT = 34

/** The marble badge on the portrait, in px. */
const BADGE = 13

/**
 * Where a face's centre falls, in px from the near edge of the strip: the card's
 * own padding, then the side's, then half a portrait.
 *
 * Exported because the bot's speech bubble hangs its tail on this number. The
 * bubble sits under this card and points up at the face that is speaking, and
 * the two only line up while they are reading the same measurement.
 */
export const FACE_CENTER = 8 + 4 + PORTRAIT / 2

/** One player as the scoreboard needs them. */
export type Seat = {
  color: Player
  name: string
  avatar?: ReactNode
  title?: string
  takenCount?: number
  active: boolean
  thinking: boolean
}

/**
 * One end of the card.
 *
 * `avatar` is what a face is when there is one — a bot's portrait now, and the
 * seam accounts will come through later. It is a node rather than a URL because
 * those two are not the same kind of thing: a bot's face is drawn from a
 * component that is already in the bundle, and an account's will be a picture
 * fetched from somewhere. The caller knows which it is holding; this card only
 * needs to know whether there is one.
 *
 * Everyone else falls back to the same anonymous head, a placeholder rather
 * than nothing, so the card is the same shape either way and a picture
 * appearing later doesn't move the name beside it.
 */
function Side({
  color,
  name,
  avatar,
  title,
  takenCount = 0,
  active,
  thinking,
  marbleDesign,
  flip,
}: Seat & { marbleDesign?: string; flip?: boolean }) {
  const { t } = useTranslation()
  const taken = Math.min(Math.max(takenCount, 0), WINNING_SCORE)

  return (
    <div
      className={cn(
        "flex min-w-0 flex-1 items-center gap-2.5 px-1 py-1.5",
        flip && "flex-row-reverse",
      )}
    >
      <div className="relative shrink-0">
        {/* The well the bot's portrait always sat in, now under every face, so
            one is framed the same way whoever it belongs to.

            The turn is an `outline` and not a `ring` so `transition-colors` can
            carry it, and it costs no layout either way — a face that grew by two
            pixels on its own turn would push the name beside it. */}
        <div
          className={cn(
            "relative flex items-center justify-center overflow-hidden rounded-lg",
            "bg-black/25 text-white/35 outline-2 transition-colors",
            active ? "outline-brand-light" : "outline-transparent",
          )}
          style={{ width: PORTRAIT, height: PORTRAIT }}
          title={title}
        >
          {avatar}
          {!avatar && <PersonIcon size={22} />}

          {/* Over the face rather than beside it: it is this player the game is
              waiting for, and their own portrait is where you are already
              looking. The ring is on at the same time and says something else —
              that it is their move; this says the move is being worked out. */}
          {thinking && (
            <span className="absolute inset-0 flex items-center justify-center bg-black/45">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/25 border-t-white motion-reduce:animate-none" />
              <span className="sr-only">
                {t("game:game_state.thinking")}
              </span>
            </span>
          )}
        </div>

        {/* Which marbles are theirs, hung off the face like a status dot, on the
            inward corner — it lands in the gap before the name, which is empty,
            rather than in the card's own edge padding, which is thinner. The rim
            is the card's fill, and that is what lifts the marble off both the
            portrait and the blue behind it. */}
        <span
          className={cn(
            "absolute -bottom-1 flex rounded-full bg-surface-4 p-[3px]",
            flip ? "-left-1" : "-right-1",
          )}
        >
          <MarbleGlyph
            color={color}
            design={marbleDesign}
            size={BADGE}
            title={t(`game:colors.${color}`)}
          />
        </span>
      </div>

      {/* The other half of the same answer: whoever is to move is the one you
          can read at full strength. */}
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-sm font-bold transition-colors",
          flip && "text-right",
          active ? "text-white" : "text-white/55",
        )}
      >
        {name}
      </span>

      {/* The figures in the middle are a score to look at, which is nothing to
          read out. This is this player's half of it, in words, next to the name
          it belongs to. */}
      <span className="sr-only">
        {t("game:controls.marbles_taken", { taken, total: WINNING_SCORE })}
        {active ? ` — ${t("game:game_state.your_turn")}` : ""}
      </span>
    </div>
  )
}

export type SeatBarProps = {
  seats: Seat[]
  marbleDesign?: string
  className?: string
}

export function SeatBar({
  seats,
  marbleDesign = "default",
  className,
}: SeatBarProps) {
  const [left, right] = seats
  const score = (seat: Seat) =>
    Math.min(Math.max(seat.takenCount ?? 0, 0), WINNING_SCORE)

  return (
    // No bottom padding: whatever comes next owns the gap to this card, so the
    // spacing down the panel is one number kept in one place.
    <div className={cn("shrink-0 px-4 pt-3", className)}>
      <div className="flex items-center rounded-xl bg-surface-4 p-2">
        <Side {...left} marbleDesign={marbleDesign} />

        {/* Dead centre, and the same width whatever the score, so neither name
            shifts as the game runs. The dash is drawn back out of the way: it is
            punctuation between two numbers, not a third thing to read. */}
        <div
          aria-hidden="true"
          className="flex shrink-0 items-baseline gap-1.5 px-2 text-lg leading-none font-bold tabular-nums text-white"
        >
          <span>{score(left)}</span>
          <span className="text-sm font-normal text-white/25">–</span>
          <span>{score(right)}</span>
        </div>

        <Side {...right} marbleDesign={marbleDesign} flip />
      </div>
    </div>
  )
}
