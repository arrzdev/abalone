import { Link } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { ChevronRightIcon } from "@/components/icons"
import { PlayerLine } from "@/components/online/player-line"
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

/**
 * One game, on the list of them.
 *
 * The line under the name is whichever fact is doing the work: on an unfinished
 * game that is whose move it is, and on a finished one it is how it ended.
 */
export function GameRow({ game, myUserId }: GameRowProps) {
  const { t } = useTranslation()

  const seat = seatOf(game, myUserId)
  const opponent = opponentOf(game, myUserId)

  const detail =
    game.status === "active"
      ? t(
          game.currentTurn === seat
            ? "online:games.your_turn"
            : "online:games.their_turn",
        )
      : t(`online:results.${resultOf(game, seat)}`, {
          reason: t(`online:reasons.${game.finishReason ?? "score"}`),
        })

  const mine = seat === "black" ? game.blackScore : game.whiteScore
  const theirs = seat === "black" ? game.whiteScore : game.blackScore

  return (
    //the whole row, because a row about one game with one place to go should
    //not make anyone find the part of it that is the link
    <Link
      to="/game/online/$gameId"
      params={{ gameId: game.id }}
      className="flex items-center gap-3 rounded-xl bg-surface-4 px-3 py-2.5 transition hover:bg-surface-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
    >
      <PlayerLine player={opponent} detail={detail} />

      <div className="shrink-0 text-right">
        <p className="font-mono text-sm font-semibold text-subtle tabular-nums">
          {mine}:{theirs}
        </p>
        <p className="mt-0.5 text-xs text-faint">
          {getSetupName(game.setupType)}
        </p>
      </div>

      <ChevronRightIcon size={18} className="shrink-0 text-faint" />
    </Link>
  )
}

/** Won, lost, or drawn, from the reader's seat. */
function resultOf(game: Game, seat: "black" | "white") {
  if (!game.winner) return "draw"
  return game.winner === seat ? "won" : "lost"
}
