import { Screen, ScrollView } from "@repo/nativ/components"
import { createFileRoute, redirect } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { WifiIcon } from "@/components/icons"
import { SubpageHeader } from "@/components/ui/subpage-header"
import { getBearerToken } from "@/data/auth/token"
import { useAuth } from "@/providers/auth-provider"

/**
 * The one route a guest cannot open.
 *
 * The guard reads the bearer token rather than a cached session, because the
 * token is the credential: no token is a guest with certainty, and a stale
 * cached user would let someone through on a session the server has since
 * dropped. A token that turns out to be dead fails on the first request
 * instead, which is where a dead token should be found out.
 *
 * There is no matchmaking yet, so what is here is the protected shape and
 * nothing else — the board arrives with the server that drives it.
 */
export const Route = createFileRoute("/_subpage/game/online")({
  beforeLoad: () => {
    if (getBearerToken()) return
    throw redirect({
      to: "/login",
      search: { redirect: "/game/online" },
      replace: true,
    })
  },
  component: GameOnlinePage,
})

function GameOnlinePage() {
  const { t } = useTranslation()
  const { user } = useAuth()

  return (
    <Screen>
      <SubpageHeader title={t("common:online.title")} />

      <ScrollView className="px-safe" directionalLockEnabled>
        <div className="mx-auto flex w-full max-w-md flex-col items-center px-4 py-10 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-4 text-white/60">
            <WifiIcon size={30} />
          </span>

          <p className="mt-5 text-sm leading-relaxed text-white/60">
            {t("common:online.body")}
          </p>

          {user && (
            <p className="mt-6 rounded-xl bg-surface-2 px-4 py-3 text-sm text-white/70">
              {t("common:online.signed_in_as", {
                username: user.displayUsername,
              })}
            </p>
          )}
        </div>
      </ScrollView>
    </Screen>
  )
}
