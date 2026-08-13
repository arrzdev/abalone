import { useTranslation } from 'react-i18next';
import { WINNING_SCORE } from '../engine/config.js';
import { avatarSrc, blurbKey, getBot, titleKey } from '../i18n/bots.js';
import { MarbleGlyph } from './MarbleGlyph.jsx';
import { cn } from '../lib/cn.js';

/**
 * The bot's voice: a portrait and a speech bubble at the top of the side panel.
 *
 * It goes here because the board column has nothing to spare. That column is
 * sized so the board comes out as large as the screen allows, and anything added
 * beside the board comes straight out of the board. The panel is a fixed 380px
 * the board never competes with, so a strip at the top of it costs the board
 * nothing.
 *
 * Below `lg` it is also the opponent's card, because there isn't one: a phone
 * playing a bot drops the row of player cards above the board, and this strip
 * takes on what they were saying — the bot's name, that it is thinking, and the
 * marbles either side has pushed off. It is already that opponent's face, so
 * none of it needs a card of its own; what it needs is the row a phone can't
 * spare for one.
 *
 * The strip's height is fixed rather than grown from the text. Lines run from
 * one word to two full rows, and a bubble that resized on each of them would
 * shunt the move list down and up all game.
 */

/** Portrait size, in px. Big enough to read a face, small enough to be a byline. */
const PORTRAIT = 48;

/** Marble size in the capture tracks, in px — the player card's, on a phone. */
const TRACK_MARBLE = 10;

/**
 * What has been pushed off, in the colour it was.
 *
 * Two groups: the white marbles black has taken, then the black ones white has
 * taken, in the order the cards stand in above `lg`. Each sits on a pill of the
 * card colour it would have been on — white marbles on the black card's fill,
 * black ones on the white card's — which is both how they read at all (a black
 * marble on this panel is a hole) and how the group says whose it is without a
 * word on it.
 *
 * Neither pill exists until there is something in it. A slot held open for a
 * marble nobody has taken yet has to be counted to be read; a pile that grows
 * does not.
 */
function Fallen({ blackTaken, whiteTaken, marbleDesign, className }) {
  const { t } = useTranslation();
  const groups = [
    { color: 'white', taken: blackTaken, by: 'black', pill: 'bg-card-black' },
    { color: 'black', taken: whiteTaken, by: 'white', pill: 'bg-card-white' },
  ];

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      {groups.map(({ color, taken, by, pill }) => {
        const count = Math.min(Math.max(taken, 0), WINNING_SCORE);
        if (count === 0) return null;
        const label = `${t(`game:colors.${by}`)} — ${t('game:controls.marbles_taken', {
          taken: count,
          total: WINNING_SCORE,
        })}`;
        return (
          <div
            key={color}
            className={cn('flex items-center gap-1 rounded-full px-1.5 py-1', pill)}
            title={label}
          >
            <span className="sr-only">{label}</span>
            {Array.from({ length: count }, (_, i) => (
              <MarbleGlyph key={i} color={color} design={marbleDesign} size={TRACK_MARBLE} />
            ))}
          </div>
        );
      })}
    </div>
  );
}

export function BotChatter({
  level,
  line,
  blackTaken = 0,
  whiteTaken = 0,
  marbleDesign = 'default',
  thinking = false,
}) {
  const { t } = useTranslation();
  const bot = getBot(level);
  // Before the first line lands there is still a bubble to fill, and an empty
  // one reads as broken. The character's own one-liner holds the space until it
  // speaks, set back so it is plainly not something it just said.
  const resting = !line;

  return (
    <div className="flex shrink-0 flex-col gap-1 px-4 pt-3 pb-1">
      {/* What the player cards say where there are none: a line of its own, over
          the strip rather than inside it. Squeezed in beside the portrait it had
          to start where the bubble starts, which left the name hanging off the
          middle of a face and nothing lined up with anything. Here the name sits
          on the same left edge as the portrait under it and the marbles on the
          same right edge as the bubble.

          Gone above `lg`, where the cards are still up there saying it. */}
      <div className="flex h-5 items-center gap-3 lg:hidden">
        <span className="truncate font-bold text-white">{bot.name}</span>
        <Fallen
          blackTaken={blackTaken}
          whiteTaken={whiteTaken}
          marbleDesign={marbleDesign}
          className="ml-auto shrink-0"
        />
      </div>

      <div className="flex items-center gap-2.5">
        {/* The portraits are cut out, with no ground of their own, so they are
            given one here — the same well the player cards use, so a bot looks
            the same in the panel as it does on its card. */}
        <div
          className="relative shrink-0 overflow-hidden rounded-lg bg-black/20"
          style={{ width: PORTRAIT, height: PORTRAIT }}
          title={`${bot.name} — ${t(titleKey(level))}`}
        >
          <img src={avatarSrc(level)} alt="" width={PORTRAIT} height={PORTRAIT} className="block" />
          {/* Only where there is no card to spin on. Over the face rather than
              beside it: it is this bot the game is waiting for, and its own
              portrait is where you are already looking. */}
          {thinking && (
            <span className="absolute inset-0 flex items-center justify-center bg-black/45 lg:hidden">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/25 border-t-white motion-reduce:animate-none" />
              <span className="sr-only">{t('game:game_state.thinking')}</span>
            </span>
          )}
        </div>

        <div className="relative flex h-12 min-w-0 flex-1 items-center rounded-xl bg-elevated px-3">
          {/* What makes this read as speech rather than as one more panel row —
              the fill on its own is too close to the furniture around it. A square
              turned on its corner, tucked behind the bubble so only the half that
              sticks out shows. */}
          <span
            aria-hidden="true"
            className="absolute top-1/2 -left-1 h-3 w-3 -translate-y-1/2 rotate-45 rounded-[2px] bg-elevated"
          />
          {/* Two rows of room, always, and never a third: the longest line in the
              roster wraps to two at this width, and the clamp is what guarantees
              the strip cannot grow if a later one runs longer. */}
          <span
            aria-live="polite"
            className={cn(
              'line-clamp-2 text-sm leading-snug',
              resting ? 'text-white/45 italic' : 'text-white',
            )}
          >
            {t(line ?? blurbKey(level))}
          </span>
        </div>
      </div>
    </div>
  );
}
