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
 * One game in progress.
 *
 * Three things carry priority, and all three of them are on this row: it sorts
 * above the games that are not waiting on you, its name and score stay at full
 * white while theirs drop a step, and the line under the score says "your move"
 * in the accent. A list where every row looks the same is a list you have to
 * read; this one you can scan.
 *
 * The score is the loudest thing on the row and set in the display face, because
 * on a list of games it is the only number, and a scoreline that reads as body
 * text is a scoreline nobody sees.
 *
 * There is no arrow. The whole row is the link — an arrow at the end of a row
 * that is entirely pressable only tells you where to aim.
 */
export function GameRow({ game, myUserId }: GameRowProps) {
  const { t } = useTranslation()

  const seat = seatOf(game, myUserId)
  const opponent = opponentOf(game, myUserId)
  const isMyTurn = game.currentTurn === seat

  const mine = seat === "black" ? game.blackScore : game.whiteScore
  const theirs = seat === "black" ? game.whiteScore : game.blackScore

  return (
    <Link
      to="/game/online/$gameId"
      params={{ gameId: game.id }}
      className="flex items-center gap-3.5 px-4 py-3 transition-colors duration-200 ease-out hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand lg:px-[18px] lg:py-[13px]"
    >
      <Avatar
        src={opponent.avatarUrl}
        name={opponent.displayUsername ?? opponent.username}
        size={40}
        className="lg:size-11"
      />

      <span className="block min-w-0 flex-1">
        <span
          className={cn(
            "block truncate text-[15px] font-semibold lg:text-base",
            isMyTurn ? "text-white" : "text-subtle",
          )}
        >
          {opponent.displayUsername ?? opponent.username}
        </span>
        <span className="mt-0.5 block truncate text-xs text-faint">
          {getSetupName(game.setupType)}
        </span>
      </span>

      <span className="shrink-0 text-right">
        <span
          className={cn(
            "block font-display text-base font-bold tabular-nums lg:text-lg",
            isMyTurn ? "text-white" : "text-subtle",
          )}
        >
          {mine}–{theirs}
        </span>
        <span
          className={cn(
            "mt-px block text-xs font-semibold",
            isMyTurn ? "text-brand-lighter" : "text-faint",
          )}
        >
          {t(
            isMyTurn
              ? "online:games.your_turn"
              : "online:games.their_turn",
          )}
        </span>
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
      to="/game/online/$gameId"
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
