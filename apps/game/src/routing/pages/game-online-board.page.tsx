import type { Player } from "@repo/abalone-engine/types"
import { cn } from "@repo/nativ/utils"
import {
  createFileRoute,
  redirect,
  useNavigate,
} from "@tanstack/react-router"
import type { CSSProperties, ReactNode } from "react"
import { useCallback, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { AppSettingsSheet } from "@/components/app-settings-sheet"
import type { GameCanvasHandle } from "@/components/game-canvas"
import { GameCanvas } from "@/components/game-canvas"
import type {
  GameOverSummary,
  ResultKind,
} from "@/components/game-over-modal"
import { GameOverModal } from "@/components/game-over-modal"
import { SettingsIcon } from "@/components/icons"
import { IngameControls } from "@/components/ingame-controls"
import type { GameResult } from "@/components/move-history"
import { PostgameControls } from "@/components/postgame-controls"
import { ResignModal } from "@/components/resign-modal"
import type { Seat } from "@/components/seat-bar"
import { SeatBar } from "@/components/seat-bar"
import { Avatar } from "@/components/ui/avatar"
import {
  SUBPAGE_HEADER_BUTTON,
  SubpageHeader,
} from "@/components/ui/subpage-header"
import { SyncNotice } from "@/components/ui/sync-notice"
import { TapButton } from "@/components/ui/tap-button"
import { useShowCoordinates } from "@/hooks/use-app-preferences"
import { useHeadToHead } from "@/hooks/use-head-to-head"
import { useMarbleDesign } from "@/hooks/use-marble-design"
import { useOnlineGame } from "@/hooks/use-online-game"
import { getSetupName } from "@/i18n/game-text"
import { needsSignIn } from "@/routing/auth-guard"
import { SignedInOnly } from "@/routing/signed-in-only"

export const Route = createFileRoute("/_subpage/game/online/$gameId")({
  beforeLoad: ({ params }) => {
    if (!needsSignIn()) return
    throw redirect({
      to: "/login",
      search: { redirect: `/game/online/${params.gameId}` },
      replace: true,
    })
  },
  component: GuardedGameOnlineBoardPage,
})

function GuardedGameOnlineBoardPage() {
  const { gameId } = Route.useParams()
  return (
    <SignedInOnly returnTo={`/game/online/${gameId}`}>
      <GameOnlineBoardPage />
    </SignedInOnly>
  )
}

function GameOnlineBoardPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { gameId } = Route.useParams()
  const boardRef = useRef<GameCanvasHandle>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [resignOpen, setResignOpen] = useState(false)
  const [resultDismissed, setResultDismissed] = useState(false)
  const [marbleDesign] = useMarbleDesign()
  const [showCoordinates] = useShowCoordinates()

  //what the canvas last sized itself to. the board is letterboxed into the box
  //it is given, so nothing around it can work its size out from the layout.
  const [board, setBoard] = useState({ width: 0, height: 0 })
  const handleBoardResize = useCallback(
    (width: number, height: number) => {
      setBoard((prev) =>
        prev.width === width && prev.height === height
          ? prev
          : { width, height },
      )
    },
    [],
  )

  const online = useOnlineGame(gameId, boardRef)
  const { game, state, mySeat } = online

  const backToList = () => navigate({ to: "/" })

  const opponent = game
    ? mySeat === "black"
      ? game.white
      : game.black
    : undefined
  const opponentName =
    opponent?.displayUsername ?? opponent?.username ?? ""

  const seatFor = (color: Player): Seat => {
    const player = color === "black" ? game?.black : game?.white
    const avatar: ReactNode = player?.avatarUrl ? (
      <Avatar
        src={player.avatarUrl}
        name={player.displayUsername ?? player.username}
        size={34}
        className="rounded-none"
      />
    ) : undefined

    return {
      color,
      name:
        player?.displayUsername ??
        player?.username ??
        t(`game:local.${color}`),
      avatar,
      //the seat shows what this player has taken off the other, which is their
      //own score: black's score is the white marbles black has pushed off
      takenCount: color === "black" ? state.blackScore : state.whiteScore,
      active: state.currentTurn === color && !state.gameOver,
      //nobody is ever waiting on a machine here, only on a person
      thinking: false,
    }
  }

  const record = useHeadToHead(game)
  //the card reads black on the left and white on the right whoever you are, and
  //the record has to follow it seat for seat
  const headToHead = record
    ? { left: record.blackWins, right: record.whiteWins }
    : undefined

  const isOver = state.gameOver

  let resultKind: ResultKind = "draw"
  if (state.winner) resultKind = state.winner === mySeat ? "win" : "loss"

  const resultTitle = t(`online:board.result_${resultKind}`)

  /**
   * The game in one row, under the result: who, what, and how it finished.
   *
   * The move count is the history less its first entry — that one is the
   * opening position, which nobody played.
   */
  const resultSummary: GameOverSummary | undefined = game
    ? {
        avatar: opponent?.avatarUrl ? (
          <Avatar
            src={opponent.avatarUrl}
            name={opponentName}
            size={44}
            className="rounded-none"
          />
        ) : undefined,
        name: opponentName,
        detail: [
          getSetupName(game.setupType),
          t("game:modal.moves", {
            count: Math.max(state.moveHistory.length - 1, 0),
          }),
        ].join(" · "),
        yourScore:
          mySeat === "black" ? state.blackScore : state.whiteScore,
        theirScore:
          mySeat === "black" ? state.whiteScore : state.blackScore,
      }
    : undefined

  const gameResult: GameResult | null = isOver
    ? {
        winner: state.winner,
        label:
          state.winner === null
            ? t("game:result.draw")
            : t(`game:result.${state.winner}_wins`),
      }
    : null

  /** The one line the panel says about where the game stands. */
  let statusLine: string
  if (online.isLoading) statusLine = t("online:board.loading")
  else if (!game) statusLine = ""
  else if (isOver) statusLine = t("online:board.finished")
  else if (state.currentTurn === mySeat)
    statusLine = t("online:board.your_move")
  else statusLine = t("online:board.waiting")

  const historyNotice =
    state.currentMoveIndex === 0
      ? t("game:history.start")
      : t("game:history.position", {
          index: state.currentMoveIndex,
          total: state.moveHistory.length - 1,
        })

  const settingsButton = (
    <TapButton
      onClick={() => setSettingsOpen(true)}
      aria-label={t("game:controls.settings")}
      title={t("game:controls.settings")}
      className={SUBPAGE_HEADER_BUTTON}
    >
      <SettingsIcon size={20} />
    </TapButton>
  )

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden select-none lg:flex-row lg:gap-4 lg:p-4">
      <SubpageHeader
        //who you are playing, which is the one thing about this game that is
        //not already drawn on the board below it
        title={
          opponentName
            ? t("online:board.against", { name: opponentName })
            : t("online:title")
        }
        backTo="/"
        action={settingsButton}
      />

      <section
        className="flex min-h-0 min-w-0 flex-1 flex-col gap-1.5 max-lg:flex-initial max-lg:px-2 max-lg:py-2"
        aria-label={t("game:board.label")}
      >
        <div
          className="flex min-h-0 min-w-0 flex-1 flex-col items-center gap-1.5 max-lg:flex-initial"
          style={
            {
              "--board-w": board.width ? `${board.width}px` : "100%",
              "--board-h": board.height ? `${board.height}px` : "100%",
            } as CSSProperties
          }
        >
          <div className="flex min-h-0 w-full flex-1 items-center justify-center max-lg:aspect-[8/7] max-lg:max-h-[48vh] max-lg:flex-initial">
            <GameCanvas
              ref={boardRef}
              state={state}
              possibleMoves={online.possibleMoves}
              marbleDesign={marbleDesign}
              showCoordinates={showCoordinates}
              notice={online.viewingHistory ? historyNotice : null}
              noticeAction={t("game:controls.jump_to_latest")}
              onReturnToLatest={online.goToLatestMove}
              interactive={online.interactive}
              onCellClick={online.handleCellClick}
              onDragSelect={online.handleDragSelect}
              onHover={online.setHoveredCell}
              onResize={handleBoardResize}
            />
          </div>
        </div>
      </section>

      <aside
        className={cn(
          "flex w-full flex-col overflow-hidden bg-surface",
          "max-lg:min-h-0 max-lg:flex-1 max-lg:rounded-none max-lg:border-0",
          "lg:min-h-0 lg:w-[380px] lg:shrink-0 lg:rounded-2xl",
        )}
      >
        <SeatBar
          seats={(["black", "white"] as Player[]).map(seatFor)}
          record={headToHead}
          marbleDesign={marbleDesign}
        />

        {/* One line under the scoreboard, and only when there is something to
            say: whose move it is while the game runs, and whatever the last
            request answered when it failed. */}
        <p
          className={cn(
            "shrink-0 px-4 pt-2 text-center text-xs",
            online.error ? "text-loss" : "text-faint",
          )}
          role={online.error ? "alert" : undefined}
        >
          {online.error ?? statusLine}
        </p>

        {/* Under the status rather than in place of it. "Your move" read off a
            board nobody has confirmed is the misleading part, and this is the
            line that says so. */}
        <SyncNotice state={online.sync} className="px-4 pt-1" />

        {isOver ? (
          <PostgameControls
            state={state}
            result={gameResult}
            canPrev={online.canPrev}
            canNext={online.canNext}
            canSkipToLatest={online.canSkipToLatest}
            marbleDesign={marbleDesign}
            onPrev={online.goPrevMove}
            onNext={online.goNextMove}
            onSkipToLatest={online.goToLatestMove}
            onGoTo={online.goToMoveIndex}
            //there is no rematch button to press here: a new game needs an
            //invite the other player answers, and both of these lead there
            onRematch={backToList}
            onNewBot={backToList}
            newGameLabel={t("online:board.back_to_games")}
          />
        ) : (
          <IngameControls
            state={state}
            canPrev={online.canPrev}
            canNext={online.canNext}
            canSkipToLatest={online.canSkipToLatest}
            //neither exists online: there is no engine to ask, and a move
            //already played is a move the other player has seen
            canHint={false}
            canUndo={false}
            hintThinking={false}
            marbleDesign={marbleDesign}
            onPrev={online.goPrevMove}
            onNext={online.goNextMove}
            onSkipToLatest={online.goToLatestMove}
            onGoTo={online.goToMoveIndex}
            onHint={noop}
            onUndo={noop}
            onResign={() => setResignOpen(true)}
          />
        )}
      </aside>

      <ResignModal
        open={resignOpen}
        onClose={() => setResignOpen(false)}
        onConfirm={() => {
          setResignOpen(false)
          online.resign()
        }}
      />

      {/* No rematch button: another game needs an invite the other player
          answers, so the two ways out of here are reading this one back and
          going to the list where a new one is offered. */}
      <GameOverModal
        open={isOver && !resultDismissed}
        state={state}
        resultKind={resultKind}
        title={resultTitle}
        summary={resultSummary}
        rematchLabel={t("online:board.review")}
        newGameLabel={t("online:board.back_to_games")}
        onClose={() => setResultDismissed(true)}
        onRematch={() => setResultDismissed(true)}
        onNewBot={backToList}
      />

      <AppSettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  )
}

/** Hint and take-back are not offered online, so neither has anything to call. */
function noop() {}
