import { useTranslation } from 'react-i18next';
import { Modal } from './ui/Modal.jsx';
import { Button } from './ui/Button.jsx';
import { FlagIcon } from './Icons.jsx';

/**
 * Confirmation for resigning.
 *
 * Resigning sits in the same bar as undo and hint, one slip of the thumb away
 * from both, and it is the only control there that ends the game outright — the
 * one action in the panel worth stopping to ask about.
 *
 * Cancel is the wider, plainer button and resign is the red one, so the shape of
 * the row says which way out is the ordinary one.
 */
export function ResignModal({ open, onClose, onConfirm }) {
  const { t } = useTranslation();

  return (
    <Modal open={open} onClose={onClose} title={t('game:modal.resign_title')}>
      <p className="text-sm leading-relaxed text-white/60">{t('game:modal.resign_body')}</p>

      <div className="mt-6 flex gap-3">
        <Button variant="secondary" className="flex-1" onClick={onClose}>
          {t('common:actions.cancel')}
        </Button>
        <Button variant="danger" className="flex-1" onClick={onConfirm}>
          <FlagIcon size={20} />
          {t('game:controls.resign')}
        </Button>
      </div>
    </Modal>
  );
}
