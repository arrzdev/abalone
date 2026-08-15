import { useQueryClient } from "@tanstack/react-query"
import {
  createFileRoute,
  redirect,
  useNavigate,
} from "@tanstack/react-router"
import type { ReactNode } from "react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { PlusIcon } from "@/components/icons"
import { GameRow } from "@/components/online/game-row"
import { InviteComposer } from "@/components/online/invite-composer"
import { InviteRow } from "@/components/online/invite-row"
import { Button } from "@/components/ui/button"
import { Card, Page, PageTitle } from "@/components/ui/page"
import { SubpageHeader } from "@/components/ui/subpage-header"
import { getBearerToken } from "@/data/auth/token"
import { useOnlineHome } from "@/hooks/use-online-home"
import { useAuth } from "@/providers/auth-provider"

/**
 * The one route a guest cannot open.
 *
 * The guard reads the bearer token rather than a cached session, because the
 * token is the credential: no token is a guest with certainty, and a stale
 * cached user would let someone through on a session the server has since
 * dropped. A token that turns out to be dead fails on the first request
 * instead, which is where a dead token should be found out.
 */
export const Route = createFileRoute("/_subpage/game/online/")({
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
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [isComposing, setIsComposing] = useState(false)

  const online = useOnlineHome(queryClient)
  const myUserId = user?.id ?? ""

  //saying yes opens a game, and the only reason to say yes is to play it — so
  //accepting lands on the board rather than on a new row to find and press
  const acceptAndOpen = (inviteId: string) =>
    online.accept(inviteId, (game) =>
      navigate({
        to: "/game/online/$gameId",
        params: { gameId: game.id },
      }),
    )

  return (
    <>
      <SubpageHeader
        title={t("online:title")}
        action={
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={t("online:compose.title")}
            onClick={() => setIsComposing(true)}
          >
            <PlusIcon size={20} />
          </Button>
        }
      />

      <Page>
        <PageTitle description={t("online:subtitle")}>
          {t("online:title")}
        </PageTitle>

        {/* The one action this screen has, and the only place above `lg` it is
            offered — on a phone it is the square in the bar. */}
        <Button
          variant="primary"
          size="lg"
          className="w-full max-lg:hidden"
          onClick={() => setIsComposing(true)}
        >
          <PlusIcon size={20} />
          {t("online:compose.title")}
        </Button>

        {online.error && (
          <p
            role="alert"
            className="rounded-xl bg-loss/10 px-4 py-3 text-sm text-loss"
          >
            {online.error}
          </p>
        )}

        <Section
          title={t("online:games.heading")}
          empty={t("online:games.empty")}
          isEmpty={online.activeGames.length === 0}
        >
          {online.activeGames.map((game) => (
            <GameRow key={game.id} game={game} myUserId={myUserId} />
          ))}
        </Section>

        <Section
          title={t("online:invites.received")}
          empty={t("online:invites.received_empty")}
          isEmpty={online.received.length === 0}
        >
          {online.received.map((invite) => (
            <InviteRow
              key={invite.id}
              invite={invite}
              direction="received"
              busy={online.isBusy}
              onAccept={acceptAndOpen}
              onDecline={online.decline}
              onRemove={online.remove}
            />
          ))}
        </Section>

        <Section
          title={t("online:invites.sent")}
          empty={t("online:invites.sent_empty")}
          isEmpty={online.sent.length === 0}
        >
          {online.sent.map((invite) => (
            <InviteRow
              key={invite.id}
              invite={invite}
              direction="sent"
              busy={online.isBusy}
              onAccept={acceptAndOpen}
              onDecline={online.decline}
              onRemove={online.remove}
            />
          ))}
        </Section>

        <Section
          title={t("online:history.heading")}
          empty={t("online:history.empty")}
          isEmpty={online.finishedGames.length === 0}
        >
          {online.finishedGames.map((game) => (
            <GameRow key={game.id} game={game} myUserId={myUserId} />
          ))}
        </Section>
      </Page>

      <InviteComposer
        open={isComposing}
        onClose={() => setIsComposing(false)}
        pending={online.isSending}
        error={online.composeError}
        onSend={(input) => online.send(input, () => setIsComposing(false))}
      />
    </>
  )
}

type SectionProps = {
  title: string
  /** What the section says when there is nothing in it. */
  empty: string
  isEmpty: boolean
  children: ReactNode
}

/** A heading and its rows, or a heading and the reason there are none. */
function Section({ title, empty, isEmpty, children }: SectionProps) {
  return (
    <Card className="flex flex-col gap-y-3">
      <h2 className="text-sm font-bold uppercase tracking-wide text-white/45">
        {title}
      </h2>

      {isEmpty ? (
        <p className="text-sm leading-relaxed text-white/40">{empty}</p>
      ) : (
        <div className="flex flex-col gap-y-2">{children}</div>
      )}
    </Card>
  )
}
