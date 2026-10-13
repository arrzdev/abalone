import { cn } from "@repo/nativ/utils"
import { Link } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { BoardThumb } from "@/components/online/board-thumb"
import { Avatar } from "@/components/ui/avatar"
import type { Game } from "@/data/online/queries"
import { gameCardOf } from "@/utils/game-card"
import { formatRelativeTime } from "@/utils/relative-time"

export type GameCardProps = {
  game: Game
  myUserId: string
  /** The time the relative times are read against, ticked by the hub. */
  now: number
  /** The bigger card the hub leads with on a wide screen. */
  lead?: boolean
}

/** "3 Oct", with the year only once it is not this one. */
function formatStartDate(
  timestamp: number,
  language: string,
  now: number,
) {
  const isThisYear =
    new Date(timestamp).getFullYear() === new Date(now).getFullYear()

  return new Intl.DateTimeFormat(language, {
    day: "numeric",
    month: "short",
    year: isThisYear ? undefined : "numeric",
  }).format(timestamp)
}

/**
 * One online game, whichever state it is in.
 *
 * Every game on the hub is this card: the position, who it is against, whose
 * move it is (or how it ended), when the last move was, when it started and the
 * score. The readings come from `gameCardOf`; this only lays them out, and the
 * state styling keys off `data-turn` (`docs/online-hub.md`).
 *
 * "Your move" is the one accent on the card. "Their move" is muted, because a
 * game you cannot touch should not compete with one you can.
 */
export function GameCard({ game, myUserId, now, lead }: GameCardProps) {
  const { t, i18n } = useTranslation()

  const card = gameCardOf(game, myUserId)

  const status =
    card.result === null
      ? t(
          `online:card.${card.turn === "mine" ? "your_move" : "their_move"}`,
        )
      : t(`online:card.${card.result}`)

  const lastMove =
    card.lastMoveAt === null
      ? t("online:card.no_moves")
      : t("online:card.last_move", {
          when: formatRelativeTime(card.lastMoveAt, i18n.language, now),
        })

  const started = t("online:card.started", {
    date: formatStartDate(card.startedAt, i18n.language, now),
  })

  return (
    <Link
      to="/online/$gameId"
      params={{ gameId: game.id }}
      data-game-card=""
      data-turn={card.turn}
      data-result={card.result ?? undefined}
      className={cn(
        "group flex min-h-24 items-center gap-3 rounded-[14px] bg-surface-2 py-2 ps-2 pe-3.5 transition-colors duration-200 ease-out hover:bg-surface-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
        lead &&
          "lg:min-h-[124px] lg:gap-[18px] lg:rounded-2xl lg:p-2.5 lg:pe-[22px]",
      )}
    >
      <span
        className={cn(
          "flex h-[77px] w-22 shrink-0 items-center justify-center",
          lead && "lg:h-26 lg:w-[118px]",
        )}
      >
        <BoardThumb
          blackCells={game.blackCells}
          whiteCells={game.whiteCells}
        />
      </span>

      <span className="block min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-2">
          <Avatar
            src={card.opponent.avatarUrl}
            name={card.opponent.name}
            size={20}
            className="shrink-0"
          />
          <span
            className={cn(
              "truncate font-display text-[15px] font-semibold text-white",
              lead && "lg:text-[19px] lg:tracking-[-0.015em]",
            )}
          >
            {card.opponent.name}
          </span>
        </span>

        <span className="mt-1 block truncate text-[13px] text-muted group-data-[turn=mine]:font-bold group-data-[turn=mine]:text-brand-lighter group-data-[result=won]:text-brand-lighter group-data-[turn=over]:font-semibold">
          {status}
        </span>

        <span className="mt-0.5 block text-xs leading-4 text-faint">
          {lastMove} · {started}
        </span>
      </span>

      <span
        className={cn(
          "shrink-0 font-display text-xl leading-none text-subtle tabular-nums",
          lead && "lg:text-[26px]",
        )}
      >
        <span
          className={cn(
            card.score.leader === "mine" && "font-bold text-white",
          )}
        >
          {card.score.mine}
        </span>
        –
        <span
          className={cn(
            card.score.leader === "theirs" && "font-bold text-white",
          )}
        >
          {card.score.theirs}
        </span>
      </span>
    </Link>
  )
}
