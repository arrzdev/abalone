import { Screen, ScrollView } from "@repo/nativ/components"
import { cn } from "@repo/nativ/utils"
import { useQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons"
import { FinishedGameRow } from "@/components/online/game-row"
import { Panel } from "@/components/ui/panel"
import { SubpageHeader } from "@/components/ui/subpage-header"
import type { Game } from "@/data/online/queries"
import { gamesQueryOptions } from "@/data/online/queries"
import { useAuth } from "@/providers/auth-provider"
import { SignedInOnly } from "@/routing/signed-in-only"
import { formatRelativeTime } from "@/utils/relative-time"

/** Rows to a page. Nine is what fills a laptop without a scrollbar. */
const PAGE_SIZE = 9

const DAY_MS = 86_400_000

type HistorySearch = { page: number }

export const Route = createFileRoute("/_subpage/online/history")({
  validateSearch: (search: Record<string, unknown>): HistorySearch => {
    const page = Number(search.page)
    return { page: Number.isInteger(page) && page > 1 ? page : 1 }
  },
  component: GuardedGamesPage,
})

function GuardedGamesPage() {
  return (
    <SignedInOnly returnTo="/online/history">
      <GamesPage />
    </SignedInOnly>
  )
}

/**
 * Every game that is over, dated and paged.
 *
 * It pages rather than growing. A history is finite and it is looked at for one
 * reason — finding a particular game — so a list that loads more of itself as
 * you fall down it is the wrong shape: you cannot tell how far in you are, and
 * you cannot come back to the same place twice. The page number is in the URL
 * for the same reason.
 *
 * There is no filter row. It would be earned if bot and pass-and-play games were
 * kept too, but only online games reach an account, so a filter here would offer
 * one choice.
 */
function GamesPage() {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const { page } = Route.useSearch()

  const { data: games = [] } = useQuery(gamesQueryOptions("finished"))
  const myUserId = user?.id ?? ""

  const sorted = [...games].sort((a, b) => b.updatedAt - a.updatedAt)
  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  //a page number out of a URL can be past the end — clamp rather than 404, since
  //the list it indexes into shrinks with nothing and grows with every game
  const current = Math.min(page, pageCount)
  const start = (current - 1) * PAGE_SIZE
  const rows = sorted.slice(start, start + PAGE_SIZE)

  const wins = sorted.filter((game) => isWin(game, myUserId)).length

  return (
    <>
      <SubpageHeader title={t("online:history.title")} />

      <Screen>
        <ScrollView className="px-safe" directionalLockEnabled>
          <div className="mx-auto flex w-full max-w-[880px] flex-col gap-5 px-4 pt-5 pb-safe-offset-10 lg:px-12 lg:pt-9">
            <div className="flex items-end justify-between gap-4">
              <div>
                {/* Above `lg` only: on a phone the bar above already carries
                    both the title and the way back. */}
                <Link
                  to="/online"
                  className="hidden items-center gap-1.5 rounded-md text-sm font-semibold text-muted transition-colors duration-200 ease-out hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand lg:inline-flex"
                >
                  <ChevronLeftIcon size={16} strokeWidth={2.2} />
                  {t("common:nav.online")}
                </Link>
                <h1 className="mt-2 hidden font-display text-[34px] font-extrabold tracking-[-0.03em] text-white lg:block">
                  {t("online:history.title")}
                </h1>
              </div>

              {/* The record, and the only place in the app it is stated. Two
                  numbers rather than a percentage: a ratio invites a judgement
                  about whether it is a good one. */}
              <div className="flex items-baseline gap-4 pb-1.5 lg:gap-[18px]">
                <Stat
                  label={t("online:history.played")}
                  value={sorted.length}
                />
                <Stat
                  label={t("online:history.won")}
                  value={wins}
                  className="text-brand-lighter"
                />
              </div>
            </div>

            {sorted.length === 0 && (
              <p className="text-sm leading-relaxed text-faint">
                {t("online:history.empty")}
              </p>
            )}

            {rows.length > 0 && (
              <Panel>
                {rows.map((game, index) => (
                  <PeriodGroup
                    key={game.id}
                    game={game}
                    previous={rows[index - 1]}
                    myUserId={myUserId}
                    language={i18n.language}
                  />
                ))}
              </Panel>
            )}

            {pageCount > 1 && (
              <div className="flex items-center justify-between gap-4 px-0.5 pt-1">
                <span className="text-[13px] text-faint tabular-nums">
                  {t("online:history.range", {
                    from: start + 1,
                    to: start + rows.length,
                    total: sorted.length,
                  })}
                </span>

                <Pagination current={current} pageCount={pageCount} />
              </div>
            )}
          </div>
        </ScrollView>
      </Screen>
    </>
  )
}

function Stat({
  label,
  value,
  className,
}: {
  label: string
  value: number
  className?: string
}) {
  return (
    <span className="text-right">
      <span
        className={cn(
          "block font-display text-[22px] font-bold text-white tabular-nums",
          className,
        )}
      >
        {value}
      </span>
      <span className="section-label block">{label}</span>
    </span>
  )
}

/**
 * A row, and the period heading above it when this row starts a new one.
 *
 * The heading belongs to the row rather than to a wrapper around a group,
 * because the groups are cut by the page boundary: a week that spans two pages
 * is labelled on both, which is what somebody paging through wants.
 */
function PeriodGroup({
  game,
  previous,
  myUserId,
  language,
}: {
  game: Game
  previous?: Game
  myUserId: string
  language: string
}) {
  const { t } = useTranslation()

  const period = periodOf(game.updatedAt)
  const isNewPeriod = !previous || periodOf(previous.updatedAt) !== period

  return (
    <>
      {isNewPeriod && (
        <div className="border-t border-border-subtle px-4 pt-3.5 pb-2.5 first:border-t-0 lg:px-[18px] lg:pt-[15px] lg:pb-[11px]">
          <h2 className="section-label">
            {t(`online:history.${period}`)}
          </h2>
        </div>
      )}

      <div className="border-t border-border-subtle">
        <FinishedGameRow
          game={game}
          myUserId={myUserId}
          when={formatRelativeTime(game.updatedAt, language)}
        />
      </div>
    </>
  )
}

function Pagination({
  current,
  pageCount,
}: {
  current: number
  pageCount: number
}) {
  const { t } = useTranslation()

  return (
    <nav className="flex items-center gap-1.5">
      <PageLink
        page={current - 1}
        disabled={current === 1}
        label={t("online:history.previous_page")}
      >
        <ChevronLeftIcon size={18} strokeWidth={2.2} />
      </PageLink>

      {Array.from({ length: pageCount }, (_, index) => index + 1).map(
        (page) => (
          <PageLink key={page} page={page} isCurrent={page === current}>
            {page}
          </PageLink>
        ),
      )}

      <PageLink
        page={current + 1}
        disabled={current === pageCount}
        label={t("online:history.next_page")}
      >
        <ChevronRightIcon size={18} strokeWidth={2.2} />
      </PageLink>
    </nav>
  )
}

function PageLink({
  page,
  isCurrent = false,
  disabled = false,
  label,
  children,
}: {
  page: number
  isCurrent?: boolean
  disabled?: boolean
  /** Only the arrows need one; a number is its own label. */
  label?: string
  children: React.ReactNode
}) {
  const className = cn(
    "inline-flex h-[38px] min-w-[38px] items-center justify-center rounded-[10px] px-3 font-display text-sm font-semibold tabular-nums transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
    isCurrent && "bg-brand text-white",
    !isCurrent &&
      "bg-surface text-subtle hover:bg-surface-2 hover:text-white",
  )

  //an arrow at either end of the range points nowhere, and a link that points
  //nowhere is still a link — so it stops being one
  if (disabled) {
    return (
      <span
        aria-hidden="true"
        className="inline-flex h-[38px] w-[38px] items-center justify-center rounded-[10px] bg-surface text-white/20"
      >
        {children}
      </span>
    )
  }

  return (
    <Link
      to="/online/history"
      search={{ page }}
      aria-label={label}
      aria-current={isCurrent ? "page" : undefined}
      className={className}
    >
      {children}
    </Link>
  )
}

function isWin(game: Game, myUserId: string) {
  const seat = game.black.userId === myUserId ? "black" : "white"
  return game.winner === seat
}

/** Which heading a game falls under, measured from now rather than from a date. */
function periodOf(timestamp: number, now = Date.now()) {
  const age = now - timestamp
  if (age < 7 * DAY_MS) return "period_week"
  if (age < 30 * DAY_MS) return "period_month"
  return "period_earlier"
}
