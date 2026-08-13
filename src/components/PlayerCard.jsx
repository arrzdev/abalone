import { useTranslation } from 'react-i18next';
import { WINNING_SCORE } from '../engine/config.js';
import { MarbleGlyph } from './MarbleGlyph.jsx';
import { cn } from '../lib/cn.js';
import { PersonIcon } from './Icons.jsx';

/**
 * Who is playing, which colour they have, and what they have taken off the
 * other side. The two cards sit side by side above the board, one per seat.
 *
 * Which marbles are yours is said by the card itself: the black player's card
 * is black and the white player's is white. That is why there is no marble
 * drawn in here any more — a black dot on a black card is a label for something
 * the label is already made of. Those two colours are the card's, always: whose
 * move it is is a blue edge drawn on top, because a card that changes colour is
 * a card that stops answering the question it is there to answer.
 *
 * Nothing in it changes size with the state of the game: the capture track
 * keeps its height empty, the turn edge is drawn inside the card rather than
 * around it, and the spinner sits over the avatar rather than beside it. A card
 * that resizes drags the board with it, and one sized to its own contents has
 * made that a much easier mistake to make.
 *
 * `color` is the player's own marble colour; `takenCount` is how many of the
 * opponent's marbles they have pushed off.
 */

/** Marble size in the capture track, in px. */
const TRACK_MARBLE = 10;

/**
 * Everything on a card that has to know whether it is the light one or the dark
 * one. Two sets rather than one set of `/opacity` utilities: the same white at
 * 10% reads as a well on a near-black card and as nothing at all on a near-white
 * one, so each side carries its own.
 */
const SEATS = {
  black: {
    fill: 'bg-card-black',
    name: 'text-white',
    well: 'bg-white/10 text-white/60',
    spinner: 'border-white/25 border-t-white',
  },
  white: {
    fill: 'bg-card-white',
    name: 'text-card-ink',
    well: 'bg-card-ink/10 text-card-ink/55',
    spinner: 'border-card-ink/20 border-t-card-ink',
  },
};

/**
 * Waiting on the engine, drawn over the avatar of whoever it is waiting for.
 *
 * An arc chasing its own ring is the one shape everyone already reads as
 * "working on it", and unlike the "Thinking…" it replaces, it is the same width
 * in every language. Over the avatar rather than beside it because the card is
 * only as wide as what is in it, and a square held empty for something that
 * only appears in a bot game is width nothing ever uses.
 */
function ThinkingSpinner({ seat }) {
  return (
    <span className="absolute inset-0 flex items-center justify-center bg-black/45">
      <span
        className={cn(
          'h-5 w-5 animate-spin rounded-full border-2 motion-reduce:animate-none',
          seat.spinner,
        )}
      />
    </span>
  );
}

/**
 * What this player has taken: the opponent's marbles, in the opponent's colour,
 * one appearing each time one is pushed off. Six of them is the game.
 *
 * It starts empty, which is the whole of it — a row that begins full of slots
 * has to be counted to be read, and it says the same thing whether you are one
 * marble up or five. Marbles you have actually won are a pile that grows in
 * front of you, and a pile is read at a glance, without a figure to go with it.
 *
 * The marbles always land on the opposite card to their own colour, which is
 * what makes them show: white ones on the black card, black ones on the white.
 *
 * The height is held whether or not there is anything in it, so that the name
 * above does not move on the first capture.
 *
 * Exported because the seat bar below the board on a phone is the same track by
 * another name — same marbles, same colours, same reason.
 */
export function CaptureTrack({ takenCount, takenColor, marbleDesign, flip, className }) {
  const { t } = useTranslation();
  const taken = Math.min(Math.max(takenCount, 0), WINNING_SCORE);
  const label = t('game:controls.marbles_taken', { taken, total: WINNING_SCORE });

  return (
    <div
      className={cn('flex h-2.5 items-center gap-1', flip && 'flex-row-reverse', className)}
      title={label}
    >
      {/* The marbles are the whole of it on screen; this is that said in words,
          which is what an empty row has instead of nothing at all. */}
      <span className="sr-only">{label}</span>
      {Array.from({ length: taken }, (_, i) => (
        <MarbleGlyph key={i} color={takenColor} design={marbleDesign} size={TRACK_MARBLE} />
      ))}
    </div>
  );
}

/**
 * The space the row of cards takes, without the cards.
 *
 * Pregame stands the row in with this. There is no game yet, so there is nothing
 * for a card to say — but the board below is the board you are about to play on,
 * and it should not jump to a different size the moment you press play. The
 * height lives here, next to the card whose height it mirrors.
 */
export function PlayerCardSlot({ className }) {
  return <div aria-hidden="true" className={cn('h-14 w-full shrink-0', className)} />;
}

export function PlayerCard({
  name,
  avatarSrc,
  avatarTitle,
  color,
  marbleDesign = 'default',
  takenCount = 0,
  thinking = false,
  active = false,
  align = 'left',
  className,
}) {
  const { t } = useTranslation();
  const flip = align === 'right';
  const seat = SEATS[color] ?? SEATS.black;

  return (
    <div
      className={cn(
        // `h-14` is mirrored by `PlayerCardSlot`.
        //
        // A width of its own only at the bottom: a card is at least this wide
        // and then as wide as it needs to be, which is what puts the two of them
        // at either end of the board with the board's own width between them
        // rather than a seam down the middle. The floor is what stops a card
        // with two words in it from shrivelling — it is a card, not a label —
        // and it is `min(45%, …)` rather than a flat 13rem so that two of them
        // and the gap always fit across the board, however narrow the board is.
        'flex h-14 min-w-[min(45%,13rem)] items-center gap-2 rounded-xl px-3 transition-colors',
        seat.fill,
        // The turn, drawn on the card rather than made of it. `outline` and not
        // `ring` so `transition-colors` can carry it, and inset so it costs no
        // layout: at the ends of the board there is nothing outside the card for
        // a ring to be drawn into.
        'outline-2 -outline-offset-2',
        active ? 'outline-brand-light' : 'outline-transparent',
        // The pair mirrors about the middle of the board, so the two read as one
        // object seen from either seat and each player's own card opens towards
        // the outside edge.
        flip && 'flex-row-reverse',
        className,
      )}
    >
      {/* The bot's card names it under the pointer as the panel's portrait does —
          a face and a name between them say who is playing, but not what kind of
          player they are. */}
      <div
        title={avatarTitle}
        className={cn(
          'relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg',
          seat.well,
        )}
      >
        {avatarSrc ? (
          <img src={avatarSrc} alt="" className="h-full w-full object-cover" />
        ) : (
          <PersonIcon size={26} />
        )}
        {active && thinking && <ThinkingSpinner seat={seat} />}
      </div>

      {/* Always stacked. Two cards share the board's width, and a name and six
          marbles on one line is more than half of that holds on a phone. */}
      <div className={cn('flex min-w-0 flex-col', flip && 'items-end')}>
        <span className={cn('max-w-full truncate font-bold', seat.name)}>{name}</span>

        <div className="mt-1.5">
          <CaptureTrack
            takenCount={takenCount}
            takenColor={color === 'black' ? 'white' : 'black'}
            marbleDesign={marbleDesign}
            flip={flip}
          />
        </div>
      </div>

      {/* Whose move it is is said by the card's own colour, which tells a screen
          reader nothing at all. This is that, in words. */}
      {active && (
        <span className="sr-only">
          {t(thinking ? 'game:game_state.thinking' : 'game:game_state.your_turn')}
        </span>
      )}
    </div>
  );
}
