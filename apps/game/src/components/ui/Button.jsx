import { useClickFix } from '../../hooks/useClickFix.js';
import { cn } from '../../lib/cn.js';

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 ' +
  'focus-visible:ring-offset-surface-2 disabled:cursor-not-allowed disabled:opacity-45';

const VARIANTS = {
  primary: 'bg-brand text-white shadow-lg shadow-brand/25 hover:bg-brand-light hover:shadow-brand/40 active:bg-brand-hover',
  secondary: 'bg-elevated-2 text-white hover:bg-elevated-3 active:bg-elevated',
  outline: 'bg-surface-4 text-white hover:bg-surface-5',
  ghost: 'text-white/70 hover:bg-white/10 hover:text-white',
  danger: 'bg-loss text-white hover:brightness-110',
};

/*
 * Icon sizes are squares of the matching text size, so an icon button sitting
 * in a row with a labelled one lines up exactly.
 *
 * `fill` is the one with no height of its own: it takes the height of the row it
 * is in, for the places where the height is the layout's to decide and the space
 * would otherwise sit empty. It has to be a size rather than a class passed in,
 * because `cn` is a join and not a merge — `h-full` alongside `h-11` is settled
 * by the stylesheet, not by which was written last.
 */
const SIZES = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-11 px-5 text-base',
  lg: 'h-14 px-6 text-lg',
  fill: 'self-stretch px-4 text-base',
  'icon-sm': 'h-9 w-9 shrink-0',
  icon: 'h-11 w-11 shrink-0',
  'icon-lg': 'h-14 w-14 shrink-0',
};

/**
 * `onClick` goes through `useClickFix`, so every button in the app presses on
 * the release of the tap that pressed it rather than on the click that follows.
 * The step buttons under the move list are the reason: they are the pair most
 * likely to be tapped several times in a row, which is the pattern iOS mistimes.
 */
export function Button({ variant = 'secondary', size = 'md', className, type = 'button', onClick, ...props }) {
  const tap = useClickFix(onClick);
  return (
    <button type={type} className={cn(BASE, VARIANTS[variant], SIZES[size], className)} {...tap} {...props} />
  );
}
