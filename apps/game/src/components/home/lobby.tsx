import { Link } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { GroupIcon, PlusIcon, RobotIcon } from "@/components/icons"
import { FinishedGameRow, GameRow } from "@/components/online/game-row"
import {
  ReceivedInviteRow,
  SentInviteRow,
} from "@/components/online/invite-row"
import { PlayOption } from "@/components/play-option"
import { Panel, PanelHeader, PanelRows } from "@/components/ui/panel"
import { SyncNotice } from "@/components/ui/sync-notice"
import type { Game } from "@/data/online/queries"
import type { OnlineHome } from "@/hooks/use-online-home"
import { usePlayActions } from "@/hooks/use-play-actions"
import { formatRelativeTime } from "@/utils/relative-time"
import type { SyncState } from "@/utils/sync-state"

/** How many finished games the lobby shows before deferring to `/games`. */
const FINISHED_PREVIEW = 5

export type LobbyProps = {
  online: OnlineHome
  myUserId: string
  onCompose: () => void
  onAccept: (inviteId: string) => void
}

/**
 * Home, signed in: the room you left.
 *
 * Two columns above `lg` and one scroll below it, and in both the order is the
 * same — the games waiting on you, then what you could start, then what somebody
 * is asking of you, then what is already over. That order is the priority; the
 * old lobby had four identical cards and left the reader to work it out.
 *
 * Only online games are here, which is what the app actually stores. An offline
 * game lives in its tab and never reaches an account, so the panel that starts
 * one says so rather than promising a row that will never appear.
 */
export function Lobby({
  online,
  myUserId,
  onCompose,
  onAccept,
}: LobbyProps) {
  const { t } = useTranslation()

  const games = sortByWhoseMove(online.activeGames, myUserId)
  const hasNothing =
    games.length === 0 &&
    online.received.length === 0 &&
    online.sent.length === 0

  //"nothing here yet" and "nobody has asked yet" look identical, and only one
  //of them is true on a first load. the placeholder is what stops the app
  //announcing an empty account for as long as the first request takes.
  if (hasNothing && online.sync === "loading") return <LobbyPlaceholder />

  if (hasNothing) {
    return <EmptyLobby onCompose={onCompose} sync={online.sync} />
  }

  return (
    <div className="mx-auto grid w-full min-h-0 max-w-6xl grid-cols-1 gap-4 px-4 pt-4 pb-safe-offset-6 lg:grid-cols-[1fr_372px] lg:gap-7 lg:px-12 lg:pt-8 lg:pb-9">
      {/* Red text and nothing behind it: a tinted panel makes the one thing
          that went wrong the brightest block on the screen. */}
      {online.error && (
        <p
          role="alert"
          className="text-sm leading-5 text-loss lg:col-span-2"
        >
          {online.error}
        </p>
      )}

      <SyncNotice
        state={online.sync}
        className="text-left lg:col-span-2"
      />

      <div className="flex min-h-0 min-w-0 flex-col gap-4 lg:gap-5">
        <Panel>
          <PanelHeader
            count={games.length}
            action={
              <button
                type="button"
                onClick={onCompose}
                className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 font-display text-[13px] font-semibold text-brand-lighter transition-colors duration-200 ease-out hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <PlusIcon size={15} strokeWidth={2.4} />
                {t("online:games.new_invite")}
              </button>
            }
          >
            {t("online:games.heading")}
          </PanelHeader>

          <PanelRows>
            {games.map((game) => (
              <GameRow key={game.id} game={game} myUserId={myUserId} />
            ))}
          </PanelRows>
        </Panel>

        <OfflinePanel />
      </div>

      <div className="flex min-h-0 min-w-0 flex-col gap-4 lg:gap-5">
        {(online.received.length > 0 || online.sent.length > 0) && (
          <InvitesPanel online={online} onAccept={onAccept} />
        )}

        <FinishedPanel games={online.finishedGames} myUserId={myUserId} />
      </div>
    </div>
  )
}

/**
 * The two ways to play that need nobody, under the games that need somebody.
 *
 * It is below the list rather than beside it because it is the thing you reach
 * for when the list has nothing for you — and the note under it is the whole
 * reason it is a separate panel: what happens here does not come back.
 */
function OfflinePanel() {
  const { t } = useTranslation()
  const { playOffline } = usePlayActions()

  return (
    <Panel className="shrink-0 p-4 lg:p-[18px]">
      <h2 className="section-label">{t("online:offline.heading")}</h2>

      <div className="mt-3 flex gap-2.5">
        <PlayOption
          icon={RobotIcon}
          tone="sunken"
          size="tile"
          className="min-w-0 flex-1"
          title={t("game:controls.mode_ai")}
          hint={t("common:home.bot_hint_short")}
          onClick={() => playOffline("ai")}
        />
        <PlayOption
          icon={GroupIcon}
          tone="sunken"
          size="tile"
          className="min-w-0 flex-1"
          title={t("game:controls.mode_local")}
          hint={t("common:home.local_hint_short")}
          onClick={() => playOffline("local")}
        />
      </div>

      <p className="mt-3 text-[13px] leading-normal text-faint">
        {t("online:offline.note")}
      </p>
    </Panel>
  )
}

type InvitesPanelProps = {
  online: OnlineHome
  onAccept: (inviteId: string) => void
}

/**
 * What somebody is asking of you, and what you have asked of them.
 *
 * One received invite keeps the full-width yes and no; from two upwards each is
 * a row with its actions at the end. Sent invites sit under their own label at
 * the bottom, smaller, because they are a record rather than a decision.
 */
function InvitesPanel({ online, onAccept }: InvitesPanelProps) {
  const { t } = useTranslation()
  const isDense = online.received.length > 1

  return (
    <Panel className="shrink-0">
      <PanelHeader count={online.received.length}>
        {t("online:invites.heading")}
      </PanelHeader>

      <PanelRows>
        {online.received.map((invite) => (
          <ReceivedInviteRow
            key={invite.id}
            invite={invite}
            dense={isDense}
            busy={online.isBusy}
            onAccept={onAccept}
            onDecline={online.decline}
          />
        ))}
      </PanelRows>

      {online.sent.length > 0 && (
        <>
          <div className="border-t border-border-subtle px-4 pt-3 pb-1 lg:px-[18px]">
            <h3 className="section-label">
              {t("online:invites.sent_heading")}
            </h3>
          </div>

          {online.sent.map((invite) => (
            <SentInviteRow
              key={invite.id}
              invite={invite}
              busy={online.isBusy}
              onRemove={online.remove}
            />
          ))}
        </>
      )}
    </Panel>
  )
}

type FinishedPanelProps = {
  games: Game[]
  myUserId: string
}

/**
 * The last few games that are over, and a way to the rest.
 *
 * It takes whatever height is left in the column and scrolls inside itself, so
 * a long history never pushes the invites above it off the screen. Five rows is
 * the preview; the count on "See all" is what says how much more there is.
 */
function FinishedPanel({ games, myUserId }: FinishedPanelProps) {
  const { t, i18n } = useTranslation()

  if (games.length === 0) return null

  return (
    <Panel className="flex min-h-0 flex-col lg:flex-1">
      <PanelHeader
        className="shrink-0"
        action={
          games.length > FINISHED_PREVIEW && (
            <Link
              to="/online/history"
              search={{ page: 1 }}
              className="rounded-lg px-1 py-1 text-[13px] text-faint transition-colors duration-200 ease-out hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              {t("online:history.see_all", { count: games.length })}
            </Link>
          )
        }
      >
        {t("online:history.heading_short")}
      </PanelHeader>

      <PanelRows className="strip-scroll min-h-0 lg:flex-1 lg:overflow-y-auto">
        {games.slice(0, FINISHED_PREVIEW).map((game) => (
          <FinishedGameRow
            key={game.id}
            game={game}
            myUserId={myUserId}
            when={formatRelativeTime(game.updatedAt, i18n.language)}
          />
        ))}
      </PanelRows>
    </Panel>
  )
}

/**
 * Signed in, and nothing to show yet — the first session after making an
 * account.
 *
 * No empty panels. Four headings over four blank boxes is the app describing its
 * own data model; what somebody needs here is the one sentence that says how a
 * game gets started and the two buttons that start one.
 */
function EmptyLobby({
  onCompose,
  sync,
}: {
  onCompose: () => void
  sync: SyncState
}) {
  const { t } = useTranslation()
  const { playOffline } = usePlayActions()

  return (
    <div className="relative flex min-h-0 flex-1 items-center justify-center px-6 py-8">
      <div className="flex w-full max-w-[452px] flex-col items-center text-center">
        {/* Above the heading, because the heading is the claim it qualifies: an
            account with games in it looks exactly like this from a phone that
            cannot reach the server. */}
        <SyncNotice state={sync} className="mb-3" />

        <h1 className="font-display text-[32px] font-extrabold tracking-[-0.03em] text-white">
          {t("online:empty.title")}
        </h1>
        <p className="mt-2.5 text-[15px] leading-relaxed text-balance text-muted">
          {t("online:empty.body")}
        </p>

        <div className="mt-6 flex w-full flex-col gap-2.5">
          <button
            type="button"
            onClick={onCompose}
            className="inline-flex h-13 w-full items-center justify-center gap-2.5 rounded-xl bg-brand font-display text-[17px] font-semibold text-white transition-colors duration-200 ease-out hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-ground"
          >
            <PlusIcon size={15} strokeWidth={2.4} />
            {t("online:compose.title")}
          </button>

          <button
            type="button"
            onClick={() => playOffline("ai")}
            className="inline-flex h-13 w-full items-center justify-center gap-2.5 rounded-xl bg-surface font-display text-[17px] font-semibold text-subtle transition-colors duration-200 ease-out hover:bg-surface-2 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-ground"
          >
            <RobotIcon size={20} className="text-muted" />
            {t("online:empty.play_bot")}
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * The lobby before the first answer has arrived, on a device holding nothing.
 *
 * Deliberately one line rather than a skeleton of the panels: which panels this
 * account has is the thing nobody knows yet, so a mock-up of four of them is a
 * guess drawn at full contrast. Somebody who has never signed in here sees this
 * once, and only for as long as one request takes.
 */
function LobbyPlaceholder() {
  const { t } = useTranslation()

  return (
    <div className="flex min-h-0 flex-1 items-center justify-center px-6 py-8">
      <output className="block text-sm text-faint">
        {t("online:games.loading")}
      </output>
    </div>
  )
}

/**
 * The games waiting on you first, and inside each half the ones that moved most
 * recently first.
 *
 * This is the cheapest of the three priority signals and the one that survives
 * not being read: somebody who never notices the accent on "your move" still
 * finds those games at the top.
 */
function sortByWhoseMove(games: Game[], myUserId: string): Game[] {
  return [...games].sort((a, b) => {
    const aMine = isMyTurn(a, myUserId)
    const bMine = isMyTurn(b, myUserId)
    if (aMine !== bMine) return aMine ? -1 : 1
    return b.updatedAt - a.updatedAt
  })
}

function isMyTurn(game: Game, myUserId: string) {
  const seat = game.black.userId === myUserId ? "black" : "white"
  return game.currentTurn === seat
}
