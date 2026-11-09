import { useTranslation } from "react-i18next"
import { AuthForm } from "@/components/auth-form"
import { MAIN_CONTENT_ID } from "@/components/skip-link"
import { Sheet } from "@/components/ui/sheet"

/**
 * Where focus goes when the sheet is dismissed and nothing had it before: the
 * page's own heading, or the page itself when it has none to land on.
 *
 * A guest sent here from a signed-in screen was never on a control, so there is
 * no opener to hand focus back to, and left alone it falls to `<body>`: a
 * screen reader says nothing about where the visitor now is. The heading says
 * what page this is.
 */
function pageHeading(): HTMLElement | null {
  return (
    document.querySelector<HTMLElement>("main h1[tabindex='-1']") ??
    document.getElementById(MAIN_CONTENT_ID)
  )
}

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
      closeButton
      restoreFocus={pageHeading}
      className="lg:max-w-[476px]"
    >
      <AuthForm onAuthenticated={onAuthenticated} />
    </Sheet>
  )
}
