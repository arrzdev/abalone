import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { TapButton } from './TapButton.jsx';
import { cn } from '../../lib/cn.js';
import { CloseIcon } from '../Icons.jsx';

/** Centred overlay dialog. Closes on Escape and on backdrop click. */
export function Modal({ open, onClose, title, children, footer, className }) {
  const { t } = useTranslation();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    // No scroll lock to take: the document never scrolls, and the page behind
    // this one keeps its scroll inside a box that doesn't chain.
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-1000 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        className={cn(
          // Never taller than the screen it sits on. A dialog with more to say
          // than fits scrolls its own body, so the title, the close button and
          // the footer stay where you left them.
          'relative flex max-h-full w-full max-w-md flex-col rounded-2xl bg-surface-2 p-6 shadow-2xl shadow-black/60',
          className,
        )}
      >
        <TapButton
          onClick={onClose}
          aria-label={t('common:actions.close')}
          className="absolute top-4 right-4 flex h-9 w-9 items-center justify-center rounded-lg text-white/50 transition hover:bg-white/10 hover:text-white"
        >
          <CloseIcon size={20} />
        </TapButton>

        {title && <h3 className="mb-4 shrink-0 pr-8 text-xl font-bold text-white">{title}</h3>}
        {/* Shrinkable rather than `flex-1`: a zero basis would collapse the body
            to nothing in a dialog that is only as tall as what it holds. */}
        <div className="panel-scroll min-h-0 overflow-y-auto">{children}</div>
        {footer && <div className="mt-6 flex shrink-0 gap-3">{footer}</div>}
      </div>
    </div>
  );
}
