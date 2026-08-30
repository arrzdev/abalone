import type { GameMode } from "@repo/abalone-engine/game-state"
import type { CellName, Player } from "@repo/abalone-engine/types"
import { cn } from "@repo/nativ/utils"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import type { CSSProperties, ReactNode } from "react"
import { useCallback, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { AppSettingsSheet } from "@/components/app-settings-sheet"
import { BotAvatar } from "@/components/bot-avatar"
import { BotChatter } from "@/components/bot-chatter"
import { EvalBar, EvalRail } from "@/components/eval-bar"
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
import { PregameControls } from "@/components/pregame-controls"
import { ResignModal } from "@/components/resign-modal"
import type { Seat } from "@/components/seat-bar"
import { SeatBar } from "@/components/seat-bar"
import {
  SUBPAGE_HEADER_BUTTON,
  SubpageHeader,
} from "@/components/ui/subpage-header"
import { TapButton } from "@/components/ui/tap-button"
import { useProfile } from "@/data/profile/queries"
import { useAbaloneGame } from "@/hooks/use-abalone-game"
import { useBotChatter } from "@/hooks/use-bot-chatter"
import { getBot, titleKey } from "@/i18n/bots"
import { getSetupName } from "@/i18n/game-text"
import { useAuth } from "@/providers/auth-provider"
import { DECIDED } from "@/utils/evaluation"

export type GameOfflineSearch = {
  /** Which of the two offline games this is. */
  mode?: GameMode
}

/**
 * `?mode=` is the switch in the setup panel, not a seed for it. The two are one
 * piece of state, so the URL holds it and the switch reads it back — a copy in
 * a `useState` would be a second answer, and the two would part company the
 * first time either changed without the other.
 *
 * Written with `replace`, because flipping a switch is not somewhere you went:
 * back belongs to the screen you came from, not to the tab you were last on.
 *
 * Anything unrecognised is dropped and the panel opens on its own default,
 * which is what a hand-typed URL should get.
 */
export const Route = createFileRoute("/_subpage/offline")({
  validateSearch: (
    search: Record<string, unknown>,
  ): GameOfflineSearch => ({
    mode:
      search.mode === "ai" || search.mode === "local"
        ? search.mode
        : undefined,
  }),
  component: GameOfflinePage,
})

/** Stable identity so the preview board never repaints for a new empty array. */
const EMPTY_MOVES: CellName[] = []

function GameOfflinePage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { data: profile } = useProfile()
  const boardRef = useRef<GameCanvasHandle>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [resignOpen, setResignOpen] = useState(false)
  /**
   * What the canvas last sized itself to. The board is letterboxed into the box
   * it is given, so nothing around it can work its size out from the layout —
   * the cards and the evaluation bar line up with it from these.
   */
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

  const { mode: searchMode } = Route.useSearch()
  const navigate = useNavigate()

  const chooseMode = useCallback(
    (next: GameMode) =>
      navigate({ to: "/offline", search: { mode: next }, replace: true }),
    [navigate],
  )

  const game = useAbaloneGame(boardRef, searchMode ?? "ai", chooseMode)
  const {
    state,
    phase,
    mode,
    possibleMoves,
    evalScore,
    viewingHistory,
    hintThinking,
    canPrev,
    canNext,
    canSkipToLatest,
    canHint,
    canUndo,
    playerColor,
    aiColor,
    difficulty,
    setupType,
    gameOverModalOpen,
    marbleDesign,
    showCoordinates,
    showEvalBar,
    localNames,
  } = game

  const isPregame = phase === "pregame"
  const isPostgame = phase === "postgame"
  const isLocal = mode === "local"

  // Hot-seat play has no bot, so there is nobody to speak and no strip to keep
  // room for — the panel goes back to exactly what it was.
  const chatter = useBotChatter({
    level: difficulty,
    enabled: !isLocal,
    phase,
    winner: state.winner,
    botColor: aiColor,
    state,
  })

  /**
   * What to call a hot-seat player: what they typed in the setup panel, or the
   * colour they are playing if they left it alone. Trimmed, so a field holding
   * nothing but spaces is still "no name given".
   */
  const localName = (color: Player) =>
    localNames[color].trim() || t(`game:local.${color}`)

  /**
   * Black on the left, white on the right, and never the other way round.
   *
   * The seats used to swap ends with the board so that yours was always the one
   * nearest you. Side by side on one strip there is no near end to be at, and a
   * pair that changed places every half turn would only be something to keep
   * re-reading. This order is the one the move list already uses.
   */
  const seatColors: Player[] = ["black", "white"]

  /**
   * Whether there is an evaluation worth drawing at all.
   *
   * Three conditions and all of them are about whether the number means
   * anything: a starting position nobody has played, a hot-seat game with no
   * engine behind it, or a player who turned the bar off.
   */
  const showEval = showEvalBar && !isPregame && !isLocal

  /**
   * The reading in words, for the column that has nowhere to write it.
   *
   * `barFraction` answers for black, so a non-negative score is black's
   * advantage and anything else is white's — except where there is no advantage
   * to name. The figure is rounded to a tenth, and once it rounds to nothing the
   * position is level: "ahead by 0.0" is a lead nobody has.
   */
  const evalShown = Math.min(Math.abs(evalScore), DECIDED)
  const evalLabel =
    evalShown < 0.05
      ? t("game:controls.eval_level")
      : t("game:controls.eval_advantage", {
          color: t(`game:colors.${evalScore >= 0 ? "black" : "white"}`),
          score: evalShown.toFixed(1),
        })

  /** Whether the game is waiting on the engine right now. */
  const botThinking =
    !isLocal &&
    phase !== "pregame" &&
    !state.gameOver &&
    !viewingHistory &&
    state.currentTurn === aiColor

  /**
   * The account at this device, when there is one and the game has room for it.
   *
   * Hot seat stays anonymous on both ends deliberately: two people sharing one
   * device are not two accounts, and putting one of their names and pictures on
   * one of the seats would be a claim about which of them it is.
   */
  const account = isLocal ? null : user

  /**
   * Who is sitting at one end of the scoreboard, in either mode.
   *
   * A bot brings a name and a face of its own. A signed-in player brings theirs.
   * Everyone else gets the anonymous head and the colour or name they typed.
   */
  const seatFor = (color: Player): Seat => {
    const isBot = !isLocal && color === aiColor
    const bot = getBot(difficulty)

    let name: string
    if (isLocal) name = localName(color)
    else if (isBot) name = bot.name
    else name = account?.displayUsername ?? t("game:players.you")

    //a node, not a url: the bot's face is a component already in the bundle and
    //the player's is a picture off the cdn, and the card only needs to be handed
    //whichever one there is
    let avatar: ReactNode
    if (isBot) {
      avatar = <BotAvatar level={difficulty} className="h-full w-full" />
    } else if (account && profile?.avatarUrl) {
      avatar = (
        <img
          src={profile.avatarUrl}
          alt=""
          className="h-full w-full object-cover"
        />
      )
    }

    return {
      color,
      // The seat shows what this player has taken off the other, which is their
      // own score — black's score is the white marbles black has pushed off.
      takenCount: color === "black" ? state.blackScore : state.whiteScore,
      active:
        state.currentTurn === color &&
        !state.gameOver &&
        phase !== "pregame",
      name,
      avatar,
      title: isBot
        ? `${bot.name} — ${t(titleKey(difficulty))}`
        : undefined,
      // Only ever the bot's: it is the only player whose turn the game spends
      // waiting on something rather than on somebody.
      thinking: isBot && botThinking,
    }
  }

  let resultKind: ResultKind
  if (state.winner === null) resultKind = "draw"
  else if (isLocal || state.winner === playerColor) resultKind = "win"
  else resultKind = "loss"

  // "Black wins" is the right sentence only while black is still called black.
  // Once someone has named themselves it is their name that won.
  let resultTitle: string | undefined
  if (!isLocal) resultTitle = undefined
  else if (state.winner === null) resultTitle = t("game:modal.draw")
  else if (localNames[state.winner].trim())
    resultTitle = t("game:local.player_wins", {
      name: localNames[state.winner].trim(),
    })
  else resultTitle = t(`game:result.${state.winner}_wins`)

  /**
   * The game in one row, under the result.
   *
   * Nothing for a hot-seat game. The row names an opponent and shows their
   * face, and two people at one device are not an opponent — the card would
   * have to pick one of them to be the other one.
   */
  const resultSummary: GameOverSummary | undefined = isLocal
    ? undefined
    : {
        avatar: <BotAvatar level={difficulty} className="h-full w-full" />,
        name: getBot(difficulty).name,
        detail: [
          t("game:controls.level", { level: difficulty }),
          getSetupName(setupType),
        ].join(" · "),
        yourScore:
          playerColor === "black" ? state.blackScore : state.whiteScore,
        theirScore:
          playerColor === "black" ? state.whiteScore : state.blackScore,
      }

  /**
   * How the game ended, for the foot of the move history.
   *
   * The side, never the person — see `ResultLine`. The modal is where the
   * result is addressed to whoever is sitting here; the history is the record
   * of the game, and a record has two players in it rather than a reader.
   */
  const gameResult: GameResult | null = state.gameOver
    ? {
        winner: state.winner,
        label:
          state.winner === null
            ? t("game:result.draw")
            : t(`game:result.${state.winner}_wins`),
      }
    : null

  /**
   * What the chip over the board says while you are stepping through the
   * history. Which position you are on, not that you are on an old one — the
   * board's own red says that already, and saying it twice was the whole
   * problem with the label this replaces.
   */
  const historyNotice =
    state.currentMoveIndex === 0
      ? t("game:history.start")
      : t("game:history.position", {
          index: state.currentMoveIndex,
          total: state.moveHistory.length - 1,
        })

  const newGameLabel = isLocal
    ? t("game:controls.new_game")
    : t("game:controls.new_bot")
  // In pregame the board is a preview of the chosen setup, not something to
  // play on — the Play button is what starts the game.
  const boardInteractive =
    phase === "ingame" && !state.gameOver && !viewingHistory

  let headerTitle: string
  if (isPregame) headerTitle = t("game:controls.new_game")
  else if (isLocal) headerTitle = t("game:controls.mode_local")
  else headerTitle = t("game:controls.page_title")

  /**
   * The gear, on a phone only.
   *
   * Above `lg` the app header is on this screen and carries the settings for
   * every screen, which is why the panel's own header lost its copy. Below `lg`
   * there is no app header and no tab bar, so this is the whole of the way to
   * them — and the board is the one screen where you want them mid-use.
   */
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
    // The page fills what the layout gives it and never scrolls — anything that
    // grows (the move list) scrolls inside its own box instead of pushing the
    // board around. Below `lg` that is the whole screen and the panel runs edge
    // to edge, so the page carries no horizontal padding there; the board column
    // pads itself.
    //
    // Nothing on it is text to be taken away either: every gesture here is aimed
    // at the board or at a control, and a drag that starts on the board was
    // dragging a line of marbles, not sweeping a selection through the title
    // above it. The name fields are excepted in the stylesheet.
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden select-none lg:flex-row lg:gap-4 lg:p-4">
      <SubpageHeader title={headerTitle} action={settingsButton} />
      {/* Board column: the board, and nothing about the game around it.
          Everything that used to frame it — who is playing, whose move it is,
          what either side has taken — is in the panel now, at every width. A
          column that holds only the board is a column that can give all of
          itself to the board, and the panel is a fixed 380px that was already
          carrying this on a phone.

          In pregame the whole column steps aside on a phone: the setup preview
          belongs under the picker that drives it, so it is rendered inside the
          panel instead. Beside the board it stays, and it is the same board it
          will be a moment later — the evaluation bar below is the one thing
          pregame leaves out, and it holds its space rather than handing it over
          for a preview larger than the game it previews. */}
      <section
        className={cn(
          // Below `lg` it takes the height its content asks for and gives the
          // rest to the panel, but stays shrinkable so a short screen squeezes
          // the board rather than overflowing.
          //
          // `min-w-0` is what keeps the panel on screen beside it. The canvas
          // carries an explicit pixel width, which is this column's min-content
          // width, and a column that may not shrink below that pushes the panel
          // off the right edge on any viewport short enough for the board to be
          // bound by height rather than width.
          "flex min-h-0 min-w-0 flex-1 flex-col gap-1.5 max-lg:flex-initial max-lg:px-2 max-lg:py-2",
          isPregame && "max-lg:hidden",
        )}
        aria-label={t("game:board.label")}
      >
        {/* Board and evaluation bar: one column, everything in it as wide as the
            board and no wider. The board is letterboxed into whatever this
            column has left over, so nothing out here can work its size out from
            the layout — `--board-w` and `--board-h` are how the canvas tells it,
            and everything that has to line up with the board reads them. */}
        <div
          className="flex min-h-0 min-w-0 flex-1 flex-col items-center gap-1.5 max-lg:flex-initial"
          style={
            {
              "--board-w": board.width ? `${board.width}px` : "100%",
              "--board-h": board.height ? `${board.height}px` : "100%",
            } as CSSProperties
          }
        >
          {/* The canvas measures this box. Below `lg` it is sized from its own
              width (the canvas is 8:7) rather than from leftover height, and
              shrinks past that only when the viewport is too short. */}
          <div className="flex min-h-0 w-full flex-1 items-center justify-center max-lg:aspect-[8/7] max-lg:max-h-[48vh] max-lg:flex-initial">
            <GameCanvas
              ref={boardRef}
              state={state}
              possibleMoves={possibleMoves}
              marbleDesign={marbleDesign}
              // Never in pregame — that board is a viewer for the starting
              // position, and the settings that belong to a game in progress
              // leave it alone. Same rule as the evaluation bar below.
              showCoordinates={showCoordinates && !isPregame}
              showLabels={!isPregame}
              notice={viewingHistory ? historyNotice : null}
              noticeAction={t("game:controls.jump_to_latest")}
              onReturnToLatest={game.goToLatestMove}
              interactive={boardInteractive}
              onCellClick={game.handleCellClick}
              onDragSelect={game.handleDragSelect}
              onHover={game.setHoveredCell}
              onResize={handleBoardResize}
            />
          </div>

          {/* Under the board and as wide as it, on a phone only.
              Beside the board the bar stands up against the panel instead —
              lying down there it had to end the board's column, and a strip
              that comes and goes is a board that resizes and slides. On end
              against a fixed-width panel it costs the board nothing, because up
              there the board is bound by height rather than width.

              Nothing to show in pregame, where the board is a viewer for a
              starting position and an evaluation of a game nobody has played is
              a number about nothing; nothing in a hot-seat game, where there is
              no engine for it to be the opinion of. */}
          {showEval && <EvalBar score={evalScore} className="lg:hidden" />}
        </div>
      </section>

      {/* The panel, and the bar fused to its leading edge. One box, so no gap
          opens between them and the panel's corners round on the outside only.
          The rail is in the row whether or not it has a bar in it, so the board
          beside it is the same size in every game. */}
      <div className="flex w-full min-h-0 max-lg:flex-1 lg:w-auto lg:shrink-0">
        <EvalRail
          score={showEval ? evalScore : undefined}
          label={showEval ? evalLabel : undefined}
        />

        <aside
          className={cn(
            "flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-surface",
            // A floating card only makes sense beside the board. Stacked on a
            // phone it is the whole screen, so it drops its corners and side
            // borders and runs to the bottom edge.
            "max-lg:rounded-none max-lg:border-0",
            "lg:w-[380px] lg:flex-none lg:rounded-2xl",
            //the bar squares off the edge it is attached to
            showEval && "lg:rounded-s-none",
          )}
        >
          {/* No header on the panel beside the board. It carried the way home and
            the settings, which are both in the app header now, and then the
            title alone — which named the panel to someone already looking at
            it. The first row of the panel is the mode switch, and that says
            what this is better than a word above it did. A phone still gets
            one, because there it is the page's own bar. */}
          {/* Above the controls rather than inside them, so it is the same strip in
            play and after the result — and so `useCompactPanel` measures what is
            actually left for the move list, which is what decides whether the
            list can stay a list. */}
          {!isPregame && (
            <SeatBar
              seats={seatColors.map(seatFor)}
              marbleDesign={marbleDesign}
            />
          )}

          {/* Only a bot has anything to say, and it says it under its own end of
            the card above. */}
          {!isLocal && !isPregame && (
            <BotChatter
              level={difficulty}
              line={chatter.line}
              side={aiColor === seatColors[0] ? "left" : "right"}
            />
          )}

          {isPregame && (
            <PregameControls
              mode={mode}
              onModeChange={game.chooseMode}
              difficulty={difficulty}
              onDifficultyChange={game.setDifficulty}
              setupType={setupType}
              onSetupChange={game.chooseSetup}
              colorChoice={game.colorChoice}
              onColorChange={game.chooseColor}
              names={localNames}
              onNameChange={game.setLocalName}
              marbleDesign={marbleDesign}
              onPlay={() => game.startNewGame()}
              preview={
                <GameCanvas
                  state={state}
                  possibleMoves={EMPTY_MOVES}
                  marbleDesign={marbleDesign}
                  showCoordinates={false}
                  showLabels={false}
                  interactive={false}
                />
              }
            />
          )}

          {phase === "ingame" && (
            <IngameControls
              state={state}
              canPrev={canPrev}
              canNext={canNext}
              canSkipToLatest={canSkipToLatest}
              canHint={canHint}
              canUndo={canUndo}
              hintThinking={hintThinking}
              marbleDesign={marbleDesign}
              onPrev={game.goPrevMove}
              onNext={game.goNextMove}
              onSkipToLatest={game.goToLatestMove}
              onGoTo={game.goToMoveIndex}
              onHint={game.requestHint}
              onUndo={game.undoMove}
              onResign={() => setResignOpen(true)}
            />
          )}

          {isPostgame && (
            <PostgameControls
              state={state}
              result={gameResult}
              canPrev={canPrev}
              canNext={canNext}
              canSkipToLatest={canSkipToLatest}
              marbleDesign={marbleDesign}
              onPrev={game.goPrevMove}
              onNext={game.goNextMove}
              onSkipToLatest={game.goToLatestMove}
              onGoTo={game.goToMoveIndex}
              onRematch={game.handleRematch}
              onNewBot={game.handleNewBot}
              newGameLabel={newGameLabel}
            />
          )}
        </aside>
      </div>

      <ResignModal
        open={resignOpen}
        onClose={() => setResignOpen(false)}
        onConfirm={() => {
          setResignOpen(false)
          game.handleResign()
        }}
      />
      <GameOverModal
        open={gameOverModalOpen}
        state={state}
        difficulty={difficulty}
        resultKind={resultKind}
        title={resultTitle}
        summary={resultSummary}
        newGameLabel={newGameLabel}
        onClose={game.closeGameOverModal}
        onRematch={game.handleRematch}
        onNewBot={game.handleNewBot}
      />
      <AppSettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  )
}
