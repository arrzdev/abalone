import { Screen, ScrollView } from "@repo/nativ/components"
import {
  createFileRoute,
  redirect,
  useNavigate,
} from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { AuthForm } from "@/components/auth-form"
import { Logo } from "@/components/logo"
import { SubpageHeader } from "@/components/ui/subpage-header"
import { hasLiveSession } from "@/data/auth/client"
import { getBearerToken } from "@/data/auth/token"
import type { ReturnTo } from "@/routing/return-to"
import {
  DEFAULT_RETURN_TO,
  parseReturnTo,
  returnToOptions,
} from "@/routing/return-to"

export type LoginSearch = {
  /** Where to go once signed in. Anything unrecognised is dropped. */
  redirect?: ReturnTo
}

/**
 * Sign in, or make an account, on a screen of its own.
 *
 * This is the desktop shape of the prompt — a phone gets the same form in a
 * drawer (`AuthPromptProvider`) and mostly lands here by typing the URL. One
 * centred column at both sizes: the form is the only thing on the screen, and
 * the width it wants is the same on a laptop as on a phone.
 *
 * A guest is never made to wait: no token means the form, immediately. A token
 * costs one round trip, because the string in storage is not proof — one the
 * server no longer honours is dropped and the form renders, rather than
 * bouncing someone home from the only screen that can sign them back in.
 */
export const Route = createFileRoute("/_subpage/login")({
  validateSearch: (search: Record<string, unknown>): LoginSearch => ({
    redirect: parseReturnTo(search.redirect),
  }),
  beforeLoad: async ({ search }) => {
    if (!getBearerToken()) return
    if (!(await hasLiveSession())) return
    throw redirect({
      ...returnToOptions(search.redirect ?? DEFAULT_RETURN_TO),
      replace: true,
    })
  },
  component: LoginPage,
})

function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { redirect: returnTo } = Route.useSearch()

  return (
    <>
      {/* The only chrome a phone gets here, and the only way back off a screen
        that has no tab bar under it. The title is the bar's job rather than the
        form's — see the heading below, which is the desktop's. */}
      <SubpageHeader title={t("common:auth.sign_in")} />

      <Screen className="relative overflow-hidden">
        {/* Centred on the pattern rather than beside a panel of screenshots. The
          form is 452px of controls and the argument for making an account is
          three lines above it; a half-screen of pictures next to that made the
          fields look like a sidebar on a marketing page. */}
        <div className="hex-texture pointer-events-none absolute inset-0 opacity-[0.035] [--hex-size:96px]" />

        <ScrollView className="relative px-safe" directionalLockEnabled>
          <div className="mx-auto flex min-h-full w-full max-w-[452px] flex-col justify-center px-6 pt-10 pb-safe-offset-10 lg:px-0">
            {/* Above the card and centred on it: the mark and what the screen
              is for. A phone has the bar's title as well, which is the one
              repeat worth having — the bar scrolls away and this does not. */}
            <div className="flex flex-col items-center gap-3.5 pb-7">
              <Logo className="size-11" />
              <h1 className="text-center font-display text-3xl font-extrabold tracking-[-0.03em] text-white">
                {t("common:auth.prompt_title")}
              </h1>
            </div>

            {/* A card here and not in the form itself: in the phone drawer the
                sheet is already this surface, and a panel inside a panel is a
                second edge around the same three controls. */}
            <AuthForm
              className="rounded-[20px] bg-surface p-6"
              onAuthenticated={() =>
                navigate({
                  ...returnToOptions(returnTo ?? DEFAULT_RETURN_TO),
                  replace: true,
                })
              }
            />
          </div>
        </ScrollView>
      </Screen>
    </>
  )
}
