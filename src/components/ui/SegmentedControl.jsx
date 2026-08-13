import { TapButton } from './TapButton.jsx';
import { cn } from '../../lib/cn.js';

/**
 * Two-or-more-way switch rendered as one pill.
 *
 * The highlight is a single absolutely-positioned element that slides
 * between segments instead of one background per button, so switching reads as
 * one thing moving. Segments are equal width (`flex-1` zeroes the basis), which
 * is what lets the indicator be sized as a plain fraction of the track.
 *
 * @param {{value: string, label: string, icon?: React.ReactNode}[]} options
 */
export function SegmentedControl({ value, onChange, options, className, ariaLabel }) {
  const activeIndex = options.findIndex((option) => option.value === value);

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn('relative flex rounded-xl bg-surface-2 p-1', className)}
    >
      {activeIndex >= 0 && (
        <span
          aria-hidden="true"
          className="absolute top-1 bottom-1 left-1 rounded-lg bg-brand shadow transition-transform duration-300 ease-out motion-reduce:transition-none"
          style={{
            // The track is the container minus its 0.25rem padding on each side.
            width: `calc((100% - 0.5rem) / ${options.length})`,
            transform: `translateX(${activeIndex * 100}%)`,
          }}
        />
      )}

      {options.map((option) => {
        const active = option.value === value;
        return (
          <TapButton
            key={option.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            title={option.label}
            className={cn(
              'relative z-10 flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-sm font-semibold',
              'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
              // Only the label brightens on hover — a background change here
              // reads as a second selected segment.
              active ? 'text-white' : 'text-white/60 hover:text-white',
            )}
          >
            {option.icon && <span className="shrink-0">{option.icon}</span>}
            {/* Labels vary a lot in length between languages. Wrapping would
                make the control taller and the two segments uneven, so a long
                one stays on its line and truncates — the full text is in the
                tooltip and the accessible name. */}
            <span className="truncate whitespace-nowrap">{option.label}</span>
          </TapButton>
        );
      })}
    </div>
  );
}
