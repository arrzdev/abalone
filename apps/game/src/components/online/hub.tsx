import { DEFAULT_SETUP } from "@repo/abalone-engine/board-setups"
import { cn } from "@repo/nativ/utils"
import { Link } from "@tanstack/react-router"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { PlusIcon, RobotIcon } from "@/components/icons"
import { GameCard } from "@/components/online/game-card"
import { InviteLinkMaker } from "@/components/online/invite-link-maker"
import {
  LeadInviteRow,
  ReceivedInviteRow,
  SentInviteRow,
} from "@/components/online/invite-row"
import { Panel, PanelHeader, PanelRows } from "@/components/ui/panel"
import { StatusLine } from "@/components/ui/status-line"
import { SyncNotice } from "@/components/ui/sync-notice"
import { TapButton } from "@/components/ui/tap-button"
import type { Game } from "@/data/online/queries"
import { useNow } from "@/hooks/use-now"
import type { OnlineHome } from "@/hooks/use-online-home"
import { usePlayActions } from "@/hooks/use-play-actions"
import { hubGroupsOf } from "@/utils/hub-groups"
import type { SyncState } from "@/utils/sync-state"

/** How many finished games the hub shows before deferring to the history. */
const FINISHED_PREVIEW = 5

/** How often the "5 min ago" on the cards is read again. */
const CLOCK_TICK_MS = 60_000

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
  const now = useNow(CLOCK_TICK_MS)

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
    return <EmptyHub sync={online.sync} />
  }

  const showInvites =
    groups.panelInvites.length > 0 || online.sent.length > 0
  const showTheirMove = groups.theirMove.length > 0
  const showFinished = online.finishedGames.length > 0
  const panelCount =
    Number(showTheirMove) + Number(showInvites) + Number(showFinished)

  return (
    <div className="mx-auto flex w-full min-h-0 max-w-[1200px] flex-col gap-4 px-3.5 pt-4.5 pb-safe-offset-6 lg:gap-5 lg:px-14 lg:pt-[30px] lg:pb-[34px]">
      <SyncNotice state={online.sync} className="text-left" />

      <HubHeading
        groups={groups}
        finishedCount={online.finishedGames.length}
        error={online.error}
        onCompose={onCompose}
      />

      {groups.lead === "games" && (
        <div className="grid shrink-0 grid-cols-1 gap-2 lg:grid-cols-2 lg:gap-3">
          {groups.yourMove.map((game) => (
            <GameCard
              key={game.id}
              game={game}
              myUserId={myUserId}
              now={now}
              lead
            />
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
              <PanelCards>
                {groups.theirMove.map((game) => (
                  <GameCard
                    key={game.id}
                    game={game}
                    myUserId={myUserId}
                    now={now}
                  />
                ))}
              </PanelCards>
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
              now={now}
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
  /** What just failed, already translated. Said in place of the count. */
  error?: string
  onCompose: () => void
}

/** What the hub's requests can come back with, for the line to hold room for. */
const HUB_ERRORS = [
  "errors:api_not_found",
  "errors:api_game_not_active",
  "errors:api_rate_limit_exceeded",
  "errors:api_service_unavailable",
  "errors:api_internal_server_error",
  "errors:network_unreachable",
  "errors:unknown",
] as const

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
  error,
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
        {/* What failed takes the place of the count under the heading,
            rather than a line of its own above it: a line that turns up at
            the top of the page pushes every card under it down, and one held
            open for it is a hole there the rest of the time. Red text and
            nothing behind it: a tinted panel makes the one thing that went
            wrong the brightest block on the screen. */}
        <StatusLine
          role="alert"
          message={error}
          messageClassName="text-loss"
          hint={
            parts.length > 0
              ? parts.join(" · ")
              : t("online:hub.nothing_else")
          }
          reserve={HUB_ERRORS.map((key) => t(key))}
          className="mt-1.5 lg:text-sm"
        />
      </div>

      {/* The word does not fit beside a heading on a phone, and a control this
          blue needs no help being found. */}
      <TapButton
        onClick={onCompose}
        aria-label={t("online:games.new_invite")}
        className="inline-flex size-11 shrink-0 items-center justify-center gap-2.5 rounded-xl bg-brand-fill font-display text-[15px] font-semibold text-white transition-colors duration-200 ease-out hover:bg-brand-fill-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-ground lg:h-[46px] lg:w-auto lg:px-5"
      >
        <PlusIcon size={19} strokeWidth={2.4} className="lg:size-4" />
        <span className="max-lg:hidden">
          {t("online:games.new_invite")}
        </span>
      </TapButton>
    </div>
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

/**
 * Game cards stacked inside a panel.
 *
 * Cards rather than rows, so a game reads the same whichever panel it is in.
 */
function PanelCards({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-2 p-2 lg:p-2.5">{children}</div>
}

type FinishedPanelProps = {
  games: Game[]
  myUserId: string
  now: number
}

/**
 * The last few games that are over, and a way to the rest.
 *
 * Five cards is the preview; the count on "See all" is what says how much more
 * there is behind it.
 */
function FinishedPanel({ games, myUserId, now }: FinishedPanelProps) {
  const { t } = useTranslation()

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
      <PanelCards>
        {games.slice(0, FINISHED_PREVIEW).map((game) => (
          <GameCard
            key={game.id}
            game={game}
            myUserId={myUserId}
            now={now}
          />
        ))}
      </PanelCards>
    </HubPanel>
  )
}

/**
 * Signed in, and nothing to show yet — the first session after making an
 * account.
 *
 * No empty panels. Three headings over three blank boxes is the app describing
 * its own data model; what somebody needs here is the one sentence that says
 * how a game gets started and the buttons that start one.
 *
 * The link leads because a new account's friends are not on Abalone yet, so
 * a username is the one thing they cannot give. It is made on the composer's
 * defaults, and the username stays a line of text under the buttons for the
 * friend who already plays.
 */
function EmptyHub({ sync }: { sync: SyncState }) {
  const { t } = useTranslation()
  const { playComputer } = usePlayActions()

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
          {t("online:empty.link_body")}
        </p>

        {/* `min-h` rather than a fixed height, and room at the ends: these
            labels are two words in English and four in German, and a button
            that cannot grow spills its second line over its own edges. The
            link's own status line sits between the two buttons, with a hint
            in it until there is news, and holds room for the longest thing it
            can say, so neither making the link nor copying it moves the
            buttons under it. */}
        <div className="mt-6 flex w-full flex-col gap-y-2">
          <InviteLinkMaker setupType={DEFAULT_SETUP} side="random" lead />

          <TapButton
            onClick={playComputer}
            className="inline-flex min-h-13 w-full items-center justify-center gap-2.5 rounded-xl bg-surface px-5 py-3 text-balance font-display text-[17px] font-semibold text-subtle transition-colors duration-200 ease-out hover:bg-surface-2 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-ground"
          >
            <RobotIcon size={20} className="text-muted" />
            {t("online:empty.play_bot")}
          </TapButton>
        </div>

        <Link
          to="/online"
          search={{ invite: "new" }}
          className="mt-3 inline-flex min-h-11 items-center rounded-lg px-3 text-[15px] text-subtle underline underline-offset-4 transition-colors duration-200 ease-out hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          {t("online:empty.invite_by_name")}
        </Link>
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
