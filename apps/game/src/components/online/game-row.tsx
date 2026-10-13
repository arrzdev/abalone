import { cn } from "@repo/nativ/utils"
import { Link } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { Avatar } from "@/components/ui/avatar"
import type { Game } from "@/data/online/queries"

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

export type HistoryGameRowProps = {
  game: Game
  /** Which seat the player reading this holds. */
  myUserId: string
  /** How long ago it ended, already worded. */
  when: string
}

/**
 * One finished game, on a page that has room for it.
 *
 * A finished game where the rows are the point rather than the tail of a panel. The name comes
 * up to full white, the score is the display face, and the date moves under the
 * score instead of into a column of its own — on a narrow panel that column is
 * what keeps the dates lined up, and at 880px it is a gap with nothing in it.
 */
export function HistoryGameRow({
  game,
  myUserId,
  when,
}: HistoryGameRowProps) {
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
      <Avatar src={opponent.avatarUrl} name={opponent.name} size={36} />

      <span className="block min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold text-white">
          {opponent.name}
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
