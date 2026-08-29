import { cn } from "@repo/nativ/utils"
import { Link } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { Avatar } from "@/components/ui/avatar"
import type { Game } from "@/data/online/queries"
import { getSetupName } from "@/i18n/game-text"

export type GameRowProps = {
  game: Game
  /** Which seat the player reading this holds. */
  myUserId: string
}

/** The other side of the board, whichever seat the reader is in. */
function opponentOf(game: Game, myUserId: string) {
  return game.black.userId === myUserId ? game.white : game.black
}

function seatOf(game: Game, myUserId: string) {
  return game.black.userId === myUserId ? "black" : "white"
}

/** Won, lost, or drawn, from the reader's seat. */
function resultOf(game: Game, seat: "black" | "white") {
  if (!game.winner) return "draw"
  return game.winner === seat ? "won" : "lost"
}

/**
 * One game that is waiting on the other player.
 *
 * Quiet on purpose. The hub gives the games needing a move from you their own
 * block at the top of the page, so everything in this list is a game you cannot
 * do anything about yet — a row to recognise, not a row to press.
 *
 * There is no caption saying whose turn it is. The panel this sits in is headed
 * "Waiting on them", and repeating that on every row is the old lobby's mistake:
 * one flat list where the only difference between a game you could play and a
 * game you could not was a word under the score.
 */
export function GameRow({ game, myUserId }: GameRowProps) {
  const seat = seatOf(game, myUserId)
  const opponent = opponentOf(game, myUserId)

  const mine = seat === "black" ? game.blackScore : game.whiteScore
  const theirs = seat === "black" ? game.whiteScore : game.blackScore

  return (
    <Link
      to="/online/$gameId"
      params={{ gameId: game.id }}
      className="flex items-center gap-3 px-4 py-2.5 transition-colors duration-200 ease-out hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand lg:px-[18px] lg:py-[11px]"
    >
      <Avatar
        src={opponent.avatarUrl}
        name={opponent.displayUsername ?? opponent.username}
        size={36}
      />

      <span className="block min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold text-subtle">
          {opponent.displayUsername ?? opponent.username}
        </span>
        <span className="mt-px block truncate text-xs text-faint">
          {getSetupName(game.setupType)}
        </span>
      </span>

      <span className="shrink-0 font-display text-sm font-semibold text-muted tabular-nums">
        {mine}–{theirs}
      </span>
    </Link>
  )
}

export type FinishedGameRowProps = GameRowProps & {
  /** How long ago it ended, already worded. */
  when: string
}

/**
 * One game that is over: quieter, and with the result where the turn used to be.
 *
 * Smaller than a live row on purpose. These are the rows you scroll past to
 * confirm something rather than the rows you came to act on, and giving them the
 * same weight as a game waiting on you is what made the old lobby unreadable.
 */
export function FinishedGameRow({
  game,
  myUserId,
  when,
}: FinishedGameRowProps) {
  const { t } = useTranslation()

  const seat = seatOf(game, myUserId)
  const opponent = opponentOf(game, myUserId)
  const result = resultOf(game, seat)

  const mine = seat === "black" ? game.blackScore : game.whiteScore
  const theirs = seat === "black" ? game.whiteScore : game.blackScore

  return (
    <Link
      to="/online/$gameId"
      params={{ gameId: game.id }}
      className="flex items-center gap-3 px-4 py-2.5 transition-colors duration-200 ease-out hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand lg:px-[18px]"
    >
      <Avatar
        src={opponent.avatarUrl}
        name={opponent.displayUsername ?? opponent.username}
        size={32}
      />

      <span className="block min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-subtle">
          {opponent.displayUsername ?? opponent.username}
        </span>
        <span
          className={cn(
            "block truncate text-xs",
            result === "won" && "text-brand-lighter",
            result === "lost" && "text-faint",
            result === "draw" && "text-faint",
          )}
        >
          {t(`online:results.${result}`, {
            reason: t(`online:reasons.${game.finishReason ?? "score"}`),
          })}
        </span>
      </span>

      <span className="shrink-0 font-display text-sm font-semibold text-muted tabular-nums">
        {mine}–{theirs}
      </span>

      <span className="w-10 shrink-0 text-right text-xs text-faint">
        {when}
      </span>
    </Link>
  )
}

/**
 * One finished game, on a page that has room for it.
 *
 * The same game as `FinishedGameRow` and a step louder, because the history is
 * where these rows are the point rather than the tail of a panel. The name comes
 * up to full white, the score is the display face, and the date moves under the
 * score instead of into a column of its own — on a narrow panel that column is
 * what keeps the dates lined up, and at 880px it is a gap with nothing in it.
 */
export function HistoryGameRow({
  game,
  myUserId,
  when,
}: FinishedGameRowProps) {
  const { t } = useTranslation()

  const seat = seatOf(game, myUserId)
  const opponent = opponentOf(game, myUserId)
  const result = resultOf(game, seat)

  const mine = seat === "black" ? game.blackScore : game.whiteScore
  const theirs = seat === "black" ? game.whiteScore : game.blackScore

  return (
    <Link
      to="/online/$gameId"
      params={{ gameId: game.id }}
      className="flex items-center gap-3.5 px-4 py-[11px] transition-colors duration-200 ease-out hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand lg:px-[18px] lg:py-3"
    >
      <Avatar
        src={opponent.avatarUrl}
        name={opponent.displayUsername ?? opponent.username}
        size={36}
      />

      <span className="block min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold text-white">
          {opponent.displayUsername ?? opponent.username}
        </span>
        <span
          className={cn(
            "mt-0.5 block truncate text-xs",
            result === "won" && "text-brand-lighter",
            result !== "won" && "text-faint",
          )}
        >
          {t(`online:results.${result}`, {
            reason: t(`online:reasons.${game.finishReason ?? "score"}`),
          })}
        </span>
      </span>

      <span className="shrink-0 text-right">
        <span
          className={cn(
            "block font-display text-base font-bold tabular-nums",
            result === "won" && "text-white",
            result !== "won" && "text-subtle",
          )}
        >
          {mine}–{theirs}
        </span>
        <span className="mt-px block text-xs text-faint">{when}</span>
      </span>
    </Link>
  )
}
