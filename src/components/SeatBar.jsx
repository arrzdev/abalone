import { useTranslation } from 'react-i18next';
import { CaptureTrack } from './PlayerCard.jsx';
import { cn } from '../lib/cn.js';

/**
 * Both seats, on one line at the top of the panel — the player cards after the
 * board has taken their row back.
 *
 * Below `lg` nothing sits above the board any more. Against a bot the chatter
 * strip was already down here and only had to be told the rest; across a table
 * there is no such strip, so this is it: the same two fills, the same names, the
 * same marbles taken and the same blue edge on whoever is to move, laid out end
 * to end instead of stacked in a card. It is about two thirds the height of the
 * row it replaces, and the board is what gets the difference.
 *
 * No avatar. A hot-seat player has no picture — the card's stand-in was a
 * generic head, which is 36px saying nothing — and the name is what they typed
 * in the setup panel, which is the part they'll recognise.
 *
 * Whose move it is matters more here than anywhere else in the app: two people
 * are sharing one screen and the board alone doesn't say who should pick it up.
 */

const SEATS = {
  black: { fill: 'bg-card-black', ink: 'text-white' },
  white: { fill: 'bg-card-white', ink: 'text-card-ink' },
};

export function SeatBar({ seats, marbleDesign = 'default', className }) {
  const { t } = useTranslation();

  return (
    <div className={cn('flex shrink-0 items-center gap-2 px-4 pt-3 pb-1', className)}>
      {seats.map(({ color, name, takenCount = 0, active }, i) => {
        // The pair mirrors about the middle, as the cards do: each player's own
        // seat opens towards their own side of the screen.
        const flip = i > 0;
        const seat = SEATS[color] ?? SEATS.black;
        return (
          <div
            key={color}
            className={cn(
              'flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg px-2.5 transition-colors',
              seat.fill,
              'outline-2 -outline-offset-2',
              active ? 'outline-brand-light' : 'outline-transparent',
              flip && 'flex-row-reverse',
            )}
          >
            <span className={cn('truncate text-sm font-bold', seat.ink)}>{name}</span>
            {/* Pushed to the far end, so the two rows of marbles grow towards
                the middle and can be compared against each other. */}
            <CaptureTrack
              takenCount={takenCount}
              takenColor={color === 'black' ? 'white' : 'black'}
              marbleDesign={marbleDesign}
              flip={flip}
              className={flip ? 'mr-auto' : 'ml-auto'}
            />
            {active && <span className="sr-only">{t('game:game_state.your_turn')}</span>}
          </div>
        );
      })}
    </div>
  );
}
