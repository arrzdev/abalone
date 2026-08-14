import { cn } from "@repo/nativ/utils"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import type { CSSProperties } from "react"
import { useCallback, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { BoardSettingsModal } from "@/components/board-settings-modal"
import { BotChatter } from "@/components/bot-chatter"
import { EvalBar, EvalBarSlot } from "@/components/eval-bar"
import type { GameCanvasHandle } from "@/components/game-canvas"
import { GameCanvas } from "@/components/game-canvas"
import type { ResultKind } from "@/components/game-over-modal"
import { GameOverModal } from "@/components/game-over-modal"
import { BackIcon, SettingsIcon } from "@/components/icons"
import { IngameControls } from "@/components/ingame-controls"
import type { GameResult } from "@/components/move-history"
import { PostgameControls } from "@/components/postgame-controls"
import { PregameControls } from "@/components/pregame-controls"
import { ResignModal } from "@/components/resign-modal"
import type { Seat } from "@/components/seat-bar"
import { SeatBar } from "@/components/seat-bar"
import { TapButton } from "@/components/ui/tap-button"
import type { CellName, Player } from "@/engine/types"
import { useAbaloneGame } from "@/hooks/use-abalone-game"
import { useBotChatter } from "@/hooks/use-bot-chatter"
import { avatarSrc as botAvatarSrc, getBot, titleKey } from "@/i18n/bots"

export const Route = createFileRoute("/game")({
  component: GamePage,
})

/** Stable identity so the preview board never repaints for a new empty array. */
const EMPTY_MOVES: CellName[] = []

/** Every control in the panel header is the same 36px square. */
const HEADER_BUTTON =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white/60 transition " +
  "hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"

function GamePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
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

  const game = useAbaloneGame(boardRef)
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
    animationsEnabled,
    autoRotate,
    localNames,
    soundVolume,
    soundMuted,
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

  /** Whether the game is waiting on the engine right now. */
  const botThinking =
    !isLocal &&
    phase !== "pregame" &&
    !state.gameOver &&
    !viewingHistory &&
    state.currentTurn === aiColor

  /**
   * Who is sitting at one end of the scoreboard, in either mode.
   *
   * A bot brings a name and a face of its own. Everyone else gets the anonymous
   * head: a hot-seat player is whoever typed a name into the setup panel, and
   * the person playing the bot is "You" until there are accounts to call them
   * anything else — which is also where their own picture will come from.
   */
  const seatFor = (color: Player): Seat => {
    const isBot = !isLocal && color === aiColor
    const bot = getBot(difficulty)

    let name: string
    if (isLocal) name = localName(color)
    else if (isBot) name = bot.name
    else name = t("game:players.you")

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
      avatarSrc: isBot ? botAvatarSrc(difficulty) : undefined,
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

  // Beside the board it is the panel's header; stacked on a phone the panel is
  // the page, so it moves to the top and becomes the page header. Only one of
  // the two is ever rendered — the other is display:none, and so out of the
  // accessibility tree too.
  const header = (className: string) => (
    <header
      className={cn(
        "flex h-14 shrink-0 items-center gap-1 bg-surface-2 px-2",
        className,
      )}
    >
      <TapButton
        onClick={() => navigate({ to: "/" })}
        aria-label={t("game:controls.back_to_home")}
        title={t("game:controls.back_to_home")}
        className={HEADER_BUTTON}
      >
        <BackIcon size={18} />
      </TapButton>

      {/* Back and settings are the same square, so the title is centred on the
          header itself and not just on the space left over. */}
      <h1 className="flex-1 truncate px-1 text-center text-lg font-bold text-white">
        {headerTitle}
      </h1>

      <TapButton
        onClick={() => setSettingsOpen(true)}
        aria-label={t("game:controls.settings")}
        title={t("game:controls.settings")}
        className={HEADER_BUTTON}
      >
        <SettingsIcon size={18} />
      </TapButton>
    </header>
  )

  const settingsModal = (
    <BoardSettingsModal
      open={settingsOpen}
      onClose={() => setSettingsOpen(false)}
      marbleDesign={marbleDesign}
      onMarbleDesignChange={game.setMarbleDesign}
      animationsEnabled={animationsEnabled}
      onAnimationsChange={game.setAnimationsEnabled}
      showCoordinates={showCoordinates}
      onShowCoordinatesChange={game.setShowCoordinates}
      showEvalBar={showEvalBar}
      onShowEvalBarChange={game.setShowEvalBar}
      autoRotate={autoRotate}
      onAutoRotateChange={game.setAutoRotate}
      showAutoRotate={isLocal}
      soundVolume={soundVolume}
      onSoundVolumeChange={game.setSoundVolume}
      soundMuted={soundMuted}
      onSoundMutedChange={game.setSoundMuted}
    />
  )

  return (
    // The page is exactly one viewport tall and never scrolls — anything that
    // grows (the move list) scrolls inside its own box instead of pushing the
    // board around. Below `lg` the panel runs edge to edge, so the page carries
    // no horizontal padding there; the board column pads itself.
    //
    // Nothing on it is text to be taken away either: every gesture here is aimed
    // at the board or at a control, and a drag that starts on the board was
    // dragging a line of marbles, not sweeping a selection through the title
    // above it. The name fields are excepted in the stylesheet.
    <div className="flex h-dvh flex-col overflow-hidden select-none lg:h-full lg:flex-row lg:gap-4 lg:p-4">
      {header("lg:hidden")}

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

          {/* Under the board, as wide as the board — and the strip is here
              whether or not there is a bar in it.

              A strip that comes and goes is a board that resizes and slides, and
              it can arrive three ways: pressing play, picking a hot-seat game,
              or turning the bar on in the settings. None of those is a reason
              for the board to move, so the column always ends in the strip and
              the bar is painted into it or it is not. See `EvalBarSlot`.

              Empty in pregame, because that board is a viewer for the starting
              position and an evaluation of a game nobody has played is a number
              about nothing. Empty in a hot-seat game, where there is no engine
              for it to be the opinion of. Empty when the setting is off.

              The empty strip is beside the board only. Below `lg` the board is
              sized from its own width and the column is stacked, so the bar
              arriving costs the panel its last row rather than the board any of
              itself — there is no shift there to hold the space against, and
              holding it anyway would be a row taken off the move list for a bar
              that is not being shown. */}
          {isPregame || isLocal || !showEvalBar ? (
            <EvalBarSlot className="max-lg:hidden" />
          ) : (
            <EvalBar score={evalScore} />
          )}
        </div>
      </section>

      {/* Side panel */}
      <aside
        className={cn(
          "flex w-full flex-col overflow-hidden bg-surface",
          // A floating card only makes sense beside the board. Stacked on a
          // phone it is the whole screen, so it drops its corners and side
          // borders and runs to the bottom edge.
          "max-lg:min-h-0 max-lg:flex-1 max-lg:rounded-none max-lg:border-0",
          "lg:min-h-0 lg:w-[380px] lg:shrink-0 lg:rounded-2xl",
        )}
      >
        {header("max-lg:hidden")}

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
        newGameLabel={newGameLabel}
        onClose={game.closeGameOverModal}
        onRematch={game.handleRematch}
        onNewBot={game.handleNewBot}
      />

      {settingsModal}
    </div>
  )
}
