import { useTranslation } from "react-i18next"
import { AuthForm } from "@/components/auth-form"
import { Sheet } from "@/components/ui/sheet"
import type { ReturnTo } from "@/routing/return-to"

export type AuthSheetProps = {
  open: boolean
  /** Where the player was going. It decides what the sheet says, not what it does. */
  destination: ReturnTo | null
  onClose: () => void
  onAuthenticated: () => void
}

/**
 * Signing in without leaving the screen: the form, in a drawer.
 *
 * A phone has one screen at a time, so sending someone to a login page means
 * losing whatever they were looking at and coming back to it by way of a
 * redirect. The drawer keeps the page underneath and hands the thumb the form,
 * which is also where the keyboard already is.
 *
 * The copy leans on where they were headed: online play has a reason it needs an
 * account, and saying it there beats a bare "sign in" over a form they did not
 * ask for.
 */
export function AuthSheet({
  open,
  destination,
  onClose,
  onAuthenticated,
}: AuthSheetProps) {
  const { t } = useTranslation()
  const forOnlinePlay = destination === "/game/online"

  const title = forOnlinePlay
    ? t("common:auth.prompt_title")
    : t("common:auth.sign_in")
  const description = forOnlinePlay
    ? t("common:auth.prompt_body")
    : undefined

  return (
    //"Entrar" over a switch whose left half says "Entrar" is the word twice in
    //two lines. It stays for a screen reader, which has no switch to look at —
    //and when there is a reason to be asking at all, the heading is that reason
    //rather than the name of the form, so it is on the screen.
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      hideTitle={!forOnlinePlay}
      description={description}
    >
      <AuthForm onAuthenticated={onAuthenticated} />
    </Sheet>
  )
}
