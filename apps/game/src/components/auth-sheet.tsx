import { useTranslation } from "react-i18next"
import { AuthForm } from "@/components/auth-form"
import { Sheet } from "@/components/ui/sheet"

export type AuthSheetProps = {
  open: boolean
  onClose: () => void
  onAuthenticated: () => void
}

/**
 * Signing in without leaving the screen: the form, in an overlay.
 *
 * A phone has one screen at a time, so sending someone to a login page means
 * losing whatever they were looking at and coming back to it by way of a
 * redirect. The overlay keeps the page underneath and hands the thumb the form,
 * which is also where the keyboard already is. Above `lg` the same overlay is a
 * centred dialog, which is `Sheet`'s split rather than a decision taken here.
 *
 * The heading is the form's own, because it changes with the tab: "Sign in to
 * play online" and "Pick a name" are two different asks and the switch between
 * them is inside the form. What stays here is the name the overlay answers to,
 * off the screen and in the accessibility tree, where a control that changes
 * under a screen reader would be worse than a fixed one.
 */
export function AuthSheet({
  open,
  onClose,
  onAuthenticated,
}: AuthSheetProps) {
  const { t } = useTranslation()

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t("common:auth.prompt_title")}
      hideTitle
    >
      <AuthForm onAuthenticated={onAuthenticated} />
    </Sheet>
  )
}
