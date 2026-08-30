import { cn } from "@repo/nativ/utils"
import { Link } from "@tanstack/react-router"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { PlusIcon, RobotIcon } from "@/components/icons"
import { BoardThumb } from "@/components/online/board-thumb"
import { FinishedGameRow, GameRow } from "@/components/online/game-row"
import {
  LeadInviteRow,
  ReceivedInviteRow,
  SentInviteRow,
} from "@/components/online/invite-row"
import { Panel, PanelHeader, PanelRows } from "@/components/ui/panel"
import { SyncNotice } from "@/components/ui/sync-notice"
import { TapButton } from "@/components/ui/tap-button"
import type { Game } from "@/data/online/queries"
import type { OnlineHome } from "@/hooks/use-online-home"
import { usePlayActions } from "@/hooks/use-play-actions"
import { getSetupName } from "@/i18n/game-text"
import { hubGroupsOf } from "@/utils/hub-groups"
import { formatRelativeTime } from "@/utils/relative-time"
import type { SyncState } from "@/utils/sync-state"

/** How many finished games the hub shows before deferring to the history. */
const FINISHED_PREVIEW = 5

/**
 * A panel row that is one column wide, two, or three.
 *
 * Written out rather than built, because a class name assembled at runtime is
 * a class name the stylesheet was never asked to generate.
 */
const PANEL_COLUMNS: Record<number, string> = {
  1: "lg:grid-cols-1",
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
}

export type HubProps = {
  online: OnlineHome
  myUserId: string
  onCompose: () => void
  onAccept: (inviteId: string) => void
}

/**
 * The online hub: whatever needs you, at the size of a page.
 *
 * The lobby this replaces sorted one list, so a game you cannot touch was the
 * same row as a game waiting on your move with a different caption under the
 * score. This splits instead. Whatever needs an answer from you gets the top of
 * the page at twice the size and with the position on it; everything else drops
 * to a panel at a third of the weight.
 *
 * That one rule is the whole layout. There is no per-state markup: the lead is
 * a move you owe, or an answer you owe, or nothing, and every set that is not
 * the lead and is not empty becomes a panel. An account with nothing in the
 * invites simply has one panel fewer, and the row of panels narrows to fit.
 *
 * Blue appears twice on this screen, on New invite and on Accept. The counts
 * beside the panel headings are plain text — a badge on each of three headings
 * is three things shouting, which is the same as none of them shouting.
 */
export function Hub({ online, myUserId, onCompose, onAccept }: HubProps) {
  const { t } = useTranslation()

  const groups = hubGroupsOf(online.activeGames, online.received, myUserId)

  const hasNothing =
    online.activeGames.length === 0 &&
    online.received.length === 0 &&
    online.sent.length === 0 &&
    online.finishedGames.length === 0

  //"nothing here yet" and "nobody has asked yet" look identical, and only one
  //of them is true on a first load. the placeholder is what stops the app
  //announcing an empty account for as long as the first request takes.
  if (hasNothing && online.sync === "loading") return <HubPlaceholder />

  if (hasNothing) {
    return <EmptyHub onCompose={onCompose} sync={online.sync} />
  }

  const showInvites =
    groups.panelInvites.length > 0 || online.sent.length > 0
  const showTheirMove = groups.theirMove.length > 0
  const showFinished = online.finishedGames.length > 0
  const panelCount =
    Number(showTheirMove) + Number(showInvites) + Number(showFinished)

  return (
    <div className="mx-auto flex w-full min-h-0 max-w-[1200px] flex-col gap-4 px-3.5 pt-4.5 pb-safe-offset-6 lg:gap-5 lg:px-14 lg:pt-[30px] lg:pb-[34px]">
      {/* Red text and nothing behind it: a tinted panel makes the one thing
          that went wrong the brightest block on the screen. */}
      {online.error && (
        <p role="alert" className="text-sm leading-5 text-loss">
          {online.error}
        </p>
      )}

      <SyncNotice state={online.sync} className="text-left" />

      <HubHeading
        groups={groups}
        finishedCount={online.finishedGames.length}
        onCompose={onCompose}
      />

      {groups.lead === "games" && (
        <div className="grid shrink-0 grid-cols-1 gap-2 lg:grid-cols-2 lg:gap-3">
          {groups.yourMove.map((game) => (
            <LeadGameCard key={game.id} game={game} myUserId={myUserId} />
          ))}
        </div>
      )}

      {groups.lead === "invites" && (
        <div className="grid shrink-0 grid-cols-1 gap-2 lg:grid-cols-2 lg:gap-3">
          {online.received.map((invite) => (
            <LeadInviteRow
              key={invite.id}
              invite={invite}
              busy={online.isBusy}
              onAccept={onAccept}
              onDecline={online.decline}
            />
          ))}
        </div>
      )}

      {panelCount > 0 && (
        <div
          className={cn(
            "grid min-h-0 flex-1 grid-cols-1 content-start items-start gap-4 lg:gap-[22px]",
            PANEL_COLUMNS[panelCount],
          )}
        >
          {showTheirMove && (
            <HubPanel
              heading={t("online:hub.waiting_on_them")}
              count={groups.theirMove.length}
            >
              <PanelRows>
                {groups.theirMove.map((game) => (
                  <GameRow key={game.id} game={game} myUserId={myUserId} />
                ))}
              </PanelRows>
            </HubPanel>
          )}

          {showInvites && (
            <HubPanel
              heading={t("online:invites.heading")}
              count={groups.panelInvites.length}
            >
              <PanelRows>
                {groups.panelInvites.map((invite) => (
                  <ReceivedInviteRow
                    key={invite.id}
                    invite={invite}
                    dense={groups.panelInvites.length > 1}
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
            </HubPanel>
          )}

          {showFinished && (
            <FinishedPanel
              games={online.finishedGames}
              myUserId={myUserId}
            />
          )}
        </div>
      )}
    </div>
  )
}

type HubHeadingProps = {
  groups: ReturnType<typeof hubGroupsOf>
  finishedCount: number
  onCompose: () => void
}

/**
 * What this account is being asked for, in one line, and the one way to start
 * something new.
 *
 * The heading names the lead rather than counting it, and the counts go
 * underneath: a count in the heading has to agree with a number that changes
 * while you read it, in thirteen languages with five plural rules between them.
 * "Your move" over "4 waiting on you" says the same thing and stays true.
 */
function HubHeading({
  groups,
  finishedCount,
  onCompose,
}: HubHeadingProps) {
  const { t } = useTranslation()

  const parts: string[] = []
  if (groups.yourMove.length > 0) {
    parts.push(
      t("online:hub.waiting_on_you", { count: groups.yourMove.length }),
    )
  }
  if (groups.theirMove.length > 0) {
    parts.push(
      t("online:hub.with_opponent", { count: groups.theirMove.length }),
    )
  }
  if (finishedCount > 0) {
    parts.push(t("online:hub.finished_count", { count: finishedCount }))
  }

  return (
    <div className="flex shrink-0 items-start gap-3.5 lg:items-center lg:gap-6">
      <div className="min-w-0 flex-1">
        <h1 className="font-display text-2xl font-bold tracking-[-0.025em] text-white lg:text-[27px]">
          {groups.lead === "games" && t("online:hub.your_move")}
          {groups.lead === "invites" && t("online:invites.heading")}
          {groups.lead === "none" &&
            groups.theirMove.length > 0 &&
            t("online:hub.idle")}
          {groups.lead === "none" &&
            groups.theirMove.length === 0 &&
            t("online:hub.none")}
        </h1>
        <p className="mt-1.5 text-[13px] text-muted lg:text-sm">
          {parts.length > 0 && parts.join(" · ")}
          {parts.length === 0 && t("online:hub.nothing_else")}
        </p>
      </div>

      {/* The word does not fit beside a heading on a phone, and a control this
          blue needs no help being found. */}
      <TapButton
        onClick={onCompose}
        aria-label={t("online:games.new_invite")}
        className="inline-flex size-11 shrink-0 items-center justify-center gap-2.5 rounded-xl bg-brand font-display text-[15px] font-semibold text-white transition-colors duration-200 ease-out hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-ground lg:h-[46px] lg:w-auto lg:px-5"
      >
        <PlusIcon size={19} strokeWidth={2.4} className="lg:size-4" />
        <span className="max-lg:hidden">
          {t("online:games.new_invite")}
        </span>
      </TapButton>
    </div>
  )
}

type LeadGameCardProps = {
  game: Game
  myUserId: string
}

/**
 * One game waiting on you, at the size of the thing it is.
 *
 * The position is on it, which is what makes it this game rather than another
 * line with a name on it: two games against the same opponent are one glance
 * apart here and identical without it. The score is the loudest thing on the
 * card because on a list of games it is the only number.
 *
 * No caption saying it is your move. Every card in this block is your move —
 * that is what the block is — and a label repeated four times says nothing the
 * fifth time either.
 */
function LeadGameCard({ game, myUserId }: LeadGameCardProps) {
  const { i18n } = useTranslation()

  const seat = game.black.userId === myUserId ? "black" : "white"
  const opponent = seat === "black" ? game.white : game.black
  const mine = seat === "black" ? game.blackScore : game.whiteScore
  const theirs = seat === "black" ? game.whiteScore : game.blackScore

  return (
    <Link
      to="/online/$gameId"
      params={{ gameId: game.id }}
      className="flex h-24 items-center gap-3 rounded-[14px] bg-surface-2 ps-2 pe-3.5 transition-colors duration-200 ease-out hover:bg-surface-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand lg:h-[124px] lg:gap-[18px] lg:rounded-2xl lg:p-2.5 lg:pe-[22px]"
    >
      <span className="flex h-[77px] w-22 shrink-0 items-center justify-center lg:h-26 lg:w-[118px]">
        <BoardThumb
          blackCells={game.blackCells}
          whiteCells={game.whiteCells}
        />
      </span>

      <span className="block min-w-0 flex-1">
        <span className="block truncate font-display text-[17px] font-semibold text-white lg:text-[21px] lg:tracking-[-0.015em]">
          {opponent.displayUsername ?? opponent.username}
        </span>
        <span className="mt-1 block truncate text-xs leading-normal text-muted lg:mt-[5px] lg:text-[13px]">
          {getSetupName(game.setupType)} ·{" "}
          {formatRelativeTime(game.updatedAt, i18n.language)}
        </span>
      </span>

      <span className="shrink-0 font-display text-xl font-bold leading-none text-white tabular-nums lg:text-[26px]">
        {mine}–{theirs}
      </span>
    </Link>
  )
}

type HubPanelProps = {
  heading: string
  count?: number
  action?: ReactNode
  children: ReactNode
}

/**
 * One of the three panels under the lead.
 *
 * It scrolls inside itself above `lg`, where the page does not scroll and a
 * long list would otherwise push the panels beside it off the bottom. On a
 * phone it is the page that scrolls, so the panel just runs to its own length.
 */
function HubPanel({ heading, count, action, children }: HubPanelProps) {
  return (
    <Panel className="flex min-w-0 min-h-0 flex-col lg:max-h-full">
      <PanelHeader className="shrink-0" count={count} action={action}>
        {heading}
      </PanelHeader>

      <div className="strip-scroll min-h-0 lg:flex-1 lg:overflow-y-auto">
        {children}
      </div>
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
 * Five rows is the preview; the count on "See all" is what says how much more
 * there is behind it.
 */
function FinishedPanel({ games, myUserId }: FinishedPanelProps) {
  const { t, i18n } = useTranslation()

  return (
    <HubPanel
      heading={t("online:history.heading_short")}
      action={
        <Link
          to="/online/history"
          search={{ page: 1 }}
          className="rounded-lg px-1 py-1 text-[13px] text-faint transition-colors duration-200 ease-out hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          {t("online:history.see_all", { count: games.length })}
        </Link>
      }
    >
      <PanelRows>
        {games.slice(0, FINISHED_PREVIEW).map((game) => (
          <FinishedGameRow
            key={game.id}
            game={game}
            myUserId={myUserId}
            when={formatRelativeTime(game.updatedAt, i18n.language)}
          />
        ))}
      </PanelRows>
    </HubPanel>
  )
}

/**
 * Signed in, and nothing to show yet — the first session after making an
 * account.
 *
 * No empty panels. Three headings over three blank boxes is the app describing
 * its own data model; what somebody needs here is the one sentence that says
 * how a game gets started and the two buttons that start one.
 */
function EmptyHub({
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

        <h1 className="font-display text-[27px] font-extrabold tracking-[-0.03em] text-white lg:text-[32px]">
          {t("online:empty.title")}
        </h1>
        <p className="mt-2.5 text-[15px] leading-relaxed text-balance text-muted">
          {t("online:empty.body")}
        </p>

        {/* `min-h` rather than a fixed height, and room at the ends: these
            labels are two words in English and four in German, and a button
            that cannot grow spills its second line over its own edges. */}
        <div className="mt-6 flex w-full flex-col gap-2.5">
          <TapButton
            onClick={onCompose}
            className="inline-flex min-h-13 w-full items-center justify-center gap-2.5 rounded-xl bg-brand px-5 py-3 text-balance font-display text-[17px] font-semibold text-white transition-colors duration-200 ease-out hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-ground"
          >
            <PlusIcon size={15} strokeWidth={2.4} />
            {t("online:compose.title")}
          </TapButton>

          <TapButton
            onClick={() => playOffline("ai")}
            className="inline-flex min-h-13 w-full items-center justify-center gap-2.5 rounded-xl bg-surface px-5 py-3 text-balance font-display text-[17px] font-semibold text-subtle transition-colors duration-200 ease-out hover:bg-surface-2 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-ground"
          >
            <RobotIcon size={20} className="text-muted" />
            {t("online:empty.play_bot")}
          </TapButton>
        </div>
      </div>
    </div>
  )
}

/**
 * The hub before the first answer has arrived, on a device holding nothing.
 *
 * Deliberately one line rather than a skeleton of the panels: which panels this
 * account has is the thing nobody knows yet, so a mock-up of three of them is a
 * guess drawn at full contrast. Somebody who has never signed in here sees this
 * once, and only for as long as one request takes.
 */
function HubPlaceholder() {
  const { t } = useTranslation()

  return (
    <div className="flex min-h-0 flex-1 items-center justify-center px-6 py-8">
      <output className="block text-sm text-faint">
        {t("online:games.loading")}
      </output>
    </div>
  )
}
