import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { TapButton } from './TapButton.jsx';
import { cn } from '../../lib/cn.js';
import { useClickOutside } from '../../hooks/useClickOutside.js';
import { CheckIcon, ChevronDownIcon } from '../Icons.jsx';

/**
 * Custom listbox replacing the native <select>, which renders with the OS
 * dropdown and cannot be themed.
 *
 * An option's `label` stays a plain string so it can also be the accessible
 * name; anything decorative goes in `icon`.
 *
 * @param {{value: string, label: string, icon?: import('react').ReactNode}[]} options
 */
export function Select({ value, onChange, options, label, className, buttonClassName }) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(() => Math.max(0, options.findIndex((o) => o.value === value)));
  const containerRef = useRef(null);
  const listRef = useRef(null);
  const listboxId = useId();

  const close = useCallback(() => setOpen(false), []);
  useClickOutside(containerRef, close, open);

  const selected = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    setActiveIndex(Math.max(0, options.findIndex((option) => option.value === value)));
  }, [open, options, value]);

  // Keep the highlighted option in view during keyboard navigation.
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  const commit = useCallback(
    (index) => {
      const option = options[index];
      if (option) onChange(option.value);
      setOpen(false);
    },
    [onChange, options],
  );

  const handleKeyDown = (event) => {
    if (!open) {
      if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
        event.preventDefault();
        setOpen(true);
      }
      return;
    }

    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        setOpen(false);
        break;
      case 'ArrowDown':
        event.preventDefault();
        setActiveIndex((index) => (index + 1) % options.length);
        break;
      case 'ArrowUp':
        event.preventDefault();
        setActiveIndex((index) => (index - 1 + options.length) % options.length);
        break;
      case 'Home':
        event.preventDefault();
        setActiveIndex(0);
        break;
      case 'End':
        event.preventDefault();
        setActiveIndex(options.length - 1);
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        commit(activeIndex);
        break;
      default:
        break;
    }
  };

  return (
    <div className={cn('relative', className)} ref={containerRef}>
      <TapButton
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-label={label}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={handleKeyDown}
        className={cn(
          'flex w-full items-center justify-between gap-3 rounded-lg bg-surface-4 px-3 py-2.5',
          'text-left text-sm font-medium text-white transition hover:bg-surface-5',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
          // Open reads as a shade up, not as an accent outline. The chevron has
          // already turned over; this is the surface agreeing with it.
          open && 'bg-surface-5',
          buttonClassName,
        )}
      >
        {selected?.icon}
        <span className="flex-1 truncate">{selected?.label}</span>
        <ChevronDownIcon size={18} className={cn('shrink-0 text-white/50 transition', open && 'rotate-180')} />
      </TapButton>

      {open && (
        // The rounding and the scrolling live on different boxes on purpose: an
        // overlay scrollbar is painted over its own element's corners, so the
        // radius has to belong to a parent that clips it.
        <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-lg bg-surface-2 shadow-2xl shadow-black/50">
          <ul
            id={listboxId}
            ref={listRef}
            role="listbox"
            aria-label={label}
            tabIndex={-1}
            className="panel-scroll max-h-64 overflow-y-auto p-1"
          >
            {options.map((option, index) => {
              const isSelected = option.value === value;
              return (
                <li key={option.value}>
                  <TapButton
                    role="option"
                    aria-selected={isSelected}
                    data-active={index === activeIndex}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => commit(index)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition',
                      index === activeIndex ? 'bg-surface-4 text-white' : 'text-white/80',
                    )}
                  >
                    {option.icon}
                    <span className="flex-1 truncate font-medium">{option.label}</span>
                    {isSelected && <CheckIcon size={16} className="shrink-0 text-brand" />}
                  </TapButton>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
