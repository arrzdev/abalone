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
 * Keeping playing is the plain button and resigning is the red one, so the shape
 * of the row says which way out is the ordinary one.
 *
 * The order flips on a phone. Side by side, the destructive answer belongs on
 * the right, away from where a back gesture starts; stacked, it belongs on top,
 * because the bottom of a sheet is where the thumb already is and that is the
 * one place this button must not be.
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

      {/* `flex-col-reverse` rather than a second pair of buttons: keeping
          playing stays first in the document, so a keyboard and a screen reader
          reach the safe answer first on both shapes. */}
      <div className="mt-6 flex flex-col-reverse gap-2.5 lg:flex-row lg:gap-2.5">
        <Button
          variant="secondary"
          className="h-13 flex-1 lg:h-12"
          onClick={onClose}
        >
          {t("game:modal.keep_playing")}
        </Button>
        <Button
          variant="danger"
          className="h-13 flex-1 lg:h-12"
          onClick={onConfirm}
        >
          <FlagIcon size={20} />
          {t("game:controls.resign")}
        </Button>
      </div>
    </Sheet>
  )
}
