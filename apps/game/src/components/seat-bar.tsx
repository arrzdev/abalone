import { WINNING_SCORE } from "@repo/abalone-engine/config"
import type { Player } from "@repo/abalone-engine/types"
import { cn } from "@repo/nativ/utils"
import type { CSSProperties, ReactNode } from "react"
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
 * Where a face's centre falls, in px from the near edge of the card's contents:
 * the side's own padding, then half a portrait.
 *
 * Measured from the contents and not from the card, because what reads it is the
 * notch over the bot's line — and an absolute box inside the card is offset from
 * exactly there. The 8px of card padding is common to both and cancels.
 */
const FACE_CENTER = 4 + PORTRAIT / 2

/** Half the notch, in px — a 9px square stood on its corner. */
const NOTCH = 4.5

/**
 * The card's height wherever a line can appear, held whether one has or not.
 *
 * Two rows of padding (16), a portrait row (46), and the line under it: its own
 * gap and rule (13) over two rows of 14px text at `leading-snug` (39). A card
 * that grew the first time the bot opened its mouth would shunt the move list
 * down the panel on the opening move of every game.
 */
const HEIGHT_WITH_NOTE = 114

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
            "bg-well text-faint outline-2 transition-colors",
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
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-border-strong border-t-white motion-reduce:animate-none" />
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
            "absolute -bottom-1 flex rounded-full bg-surface-2 p-[3px]",
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
          active ? "text-white" : "text-muted",
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

/**
 * Wins each of these two has taken off the other before today, in the same
 * order as the seats. Only for two players who have met — a record of nothing
 * is a line saying they are strangers.
 */
export type SeatRecord = {
  left: number
  right: number
}

/**
 * The series, under the game: how many of the games these two have played
 * before this one each of them won.
 *
 * A second row rather than a second line in the middle column, because the two
 * numbers were the problem. Stacked under the live score they read as another
 * score of the same kind — one glance short of telling you which of the two was
 * the game in front of you. Here each figure sits at its own player's end of the
 * card, directly under that face, and the words between them say what they are.
 * Nothing has to be decoded: the number under you is yours.
 *
 * Separated by a rule and drawn quieter than everything above it, because it is
 * the one thing on this card that is not about the position on the board.
 */
function Record({
  record,
  leftName,
  rightName,
}: {
  record: SeatRecord
  leftName: string
  rightName: string
}) {
  const { t } = useTranslation()

  return (
    <div className="mt-1.5 flex items-center gap-2 border-t border-border-subtle px-2 pt-1.5">
      <span
        aria-hidden="true"
        className="w-8 shrink-0 font-display text-xs leading-none font-bold tabular-nums text-muted"
      >
        {record.left}
      </span>
      <span
        aria-hidden="true"
        className="min-w-0 flex-1 truncate text-center text-[11px] leading-none text-faint"
      >
        {t("online:board.head_to_head")}
      </span>
      <span
        aria-hidden="true"
        className="w-8 shrink-0 text-right font-display text-xs leading-none font-bold tabular-nums text-muted"
      >
        {record.right}
      </span>

      {/* Three pieces read left to right are three pieces to reassemble, so the
          row is said once as a sentence with the names in it. */}
      <span className="sr-only">
        {t("online:board.head_to_head_detail", {
          left: leftName,
          leftWins: record.left,
          right: rightName,
          rightWins: record.right,
        })}
      </span>
    </div>
  )
}

/**
 * The line along the bottom of the card: what the bot just said, whose move the
 * game is waiting for, or what the last request came back with.
 *
 * All three used to sit outside the card — the bot in its own darker bubble with
 * a tail, the online status as a stray centred line under everything. Both are
 * about the two people on this card, so both belong on it. A second surface 8px
 * away, pointing back, was a lot of drawing to say what the position of the
 * words says on its own.
 *
 * A line about one of them sits at that player's end with the rule notched up
 * towards their face — so "waiting" and "your move" are the same sentence read
 * off which end it is written at. A line about neither, a result or a failure,
 * is centred and has no notch to point with.
 *
 * Set quieter than the names above it: it is the one row here that is not the
 * position on the board.
 */
function Note({
  text,
  side,
  tone = "plain",
}: SeatNote & { text: string }) {
  return (
    <div className="relative mt-1.5 border-t border-border-subtle px-2 pt-1.5">
      {side && (
        <span
          aria-hidden="true"
          className="absolute -top-[5px] h-[9px] w-[9px] rotate-45 rounded-[1px] border-s border-t border-border-subtle bg-surface-2"
          style={{ [side]: FACE_CENTER - NOTCH } as CSSProperties}
        />
      )}
      {/* Two rows of room and never a third: the longest line in the bot's
          roster wraps to two at this width, and the clamp is what keeps a later
          one from being the first to make the card taller. */}
      <span
        aria-live="polite"
        role={tone === "error" ? "alert" : undefined}
        className={cn(
          "line-clamp-2 text-sm leading-snug",
          tone === "error" ? "text-loss" : "text-subtle",
          !side && "text-center",
          side === "right" && "text-right",
        )}
      >
        {text}
      </span>
    </div>
  )
}

/** The card's bottom line: what it says and who it is about. */
export type SeatNote = {
  /** Already translated. Null holds the room without filling it. */
  text: string | null
  /** Whose line it is. Centred and un-notched when it is nobody's. */
  side?: "left" | "right"
  tone?: "plain" | "error"
}

export type SeatBarProps = {
  seats: Seat[]
  record?: SeatRecord
  /** Only where a line can appear. Its absence is what keeps the card short. */
  note?: SeatNote
  marbleDesign?: string
  className?: string
}

export function SeatBar({
  seats,
  record,
  note,
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
      {/* Centred rather than stacked from the top, because the room under the
          score is held open from the first frame and is empty until there is
          something to write there. Sat at the top of it, the card would open
          looking like it had lost half its contents. */}
      <div
        className="flex flex-col justify-center rounded-xl bg-surface-2 p-2"
        style={note ? { minHeight: HEIGHT_WITH_NOTE } : undefined}
      >
        <div className="flex items-center">
          <Side {...left} marbleDesign={marbleDesign} />

          {/* Dead centre, and the same width whatever the score, so neither name
            shifts as the game runs. The dash is drawn back out of the way: it is
            punctuation between two numbers, not a third thing to read. */}
          <div
            aria-hidden="true"
            className="flex shrink-0 items-baseline gap-1.5 px-2 font-display text-lg leading-none font-bold tabular-nums text-white"
          >
            <span>{score(left)}</span>
            <span className="font-sans text-sm font-normal text-faint">
              –
            </span>
            <span>{score(right)}</span>
          </div>

          <Side {...right} marbleDesign={marbleDesign} flip />
        </div>

        {record && (
          <Record
            record={record}
            leftName={left.name}
            rightName={right.name}
          />
        )}

        {note?.text && <Note {...note} text={note.text} />}
      </div>
    </div>
  )
}
