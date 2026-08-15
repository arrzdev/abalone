import { useTranslation } from "react-i18next"
import { FlagIcon } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { Sheet } from "@/components/ui/sheet"

export type ResignModalProps = {
  open: boolean
  onClose: () => void
  onConfirm: () => void
}

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
export function ResignModal({
  open,
  onClose,
  onConfirm,
}: ResignModalProps) {
  const { t } = useTranslation()

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t("game:modal.resign_title")}
    >
      <p className="text-sm leading-relaxed text-muted">
        {t("game:modal.resign_body")}
      </p>

      <div className="mt-6 flex gap-3">
        <Button variant="secondary" className="flex-1" onClick={onClose}>
          {t("common:actions.cancel")}
        </Button>
        <Button variant="danger" className="flex-1" onClick={onConfirm}>
          <FlagIcon size={20} />
          {t("game:controls.resign")}
        </Button>
      </div>
    </Sheet>
  )
}
