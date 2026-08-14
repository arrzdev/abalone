import type { RefObject } from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { BotClient } from "@/ai/bot-client"
import type { ColorChoiceValue } from "@/components/color-choice"
import type { GameCanvasHandle } from "@/components/game-canvas"
import type { SetupKey } from "@/engine/board-setups"
import { DEFAULT_SETUP } from "@/engine/board-setups"
import type { GameMode, GameState } from "@/engine/game-state"
import {
  canNextMove,
  canPrevMove,
  createGameState,
  getMarbleAt,
  goToMove,
  isBlackTurn,
  isValidSelection,
  isViewingHistory,
  makeMove,
  nextMove,
  prevMove,
  resignGame,
  toSearchState,
  truncateToMove,
  undoTargetIndex,
} from "@/engine/game-state"
import {
  deselectMarble,
  getPossibleMoves,
  selectMarble,
  selectRun,
} from "@/engine/rules"
import type { CellName, Player } from "@/engine/types"
import type { GamePhase } from "@/hooks/use-bot-chatter"
import { useMarbleDesign } from "@/hooks/use-marble-design"
import { usePersistentState } from "@/hooks/use-persistent-state"
import { hasDesign } from "@/render/marble-renderer"
import {
  ANIMATE_BY_DEFAULT,
  prefersReducedMotion,
  TIMING,
} from "@/render/motion"
import { evaluateBoard } from "@/utils/evaluation"
import { PREF_PREFIX, parseStored, serialize } from "@/utils/preferences"
import {
  DEFAULT_VOLUME,
  playFallSound,
  playMoveSound,
  primeSounds,
  setSoundMuted,
  setSoundVolume,
} from "@/utils/sound"

/** Hot-seat names, one per side. */
export type LocalNames = Record<Player, string>

/**
 * Hot-seat players name themselves in the setup panel. Blank means "no name
 * given" rather than an empty card — whoever reads these falls back to the
 * colour, which is what the cards said before there was anywhere to type.
 */
const NO_LOCAL_NAMES: LocalNames = { black: "", white: "" }

/** Long enough for a name, short of anything that would crowd a card. */
const MAX_LOCAL_NAME = 20

/**
 * Hints are searched at a fixed strength on their own engine instance: advice
 * from the level-1 bot would be level-1 advice, and a hint must not disturb the
 * opponent's own repetition table.
 */
const HINT_LEVEL = 7

/** 'random' is only settled at the moment a game actually starts. */
function resolveColor(choice: ColorChoiceValue): Player {
  if (choice !== "random") return choice
  return Math.random() < 0.5 ? "black" : "white"
}

export type NewGameOptions = {
  setupType?: SetupKey
  colorChoice?: ColorChoiceValue
  difficulty?: number
  mode?: GameMode
  pregame?: boolean
}

/**
 * Owns the whole game: board state, pregame settings, AI turns and animation
 * sequencing — everything that is true of the game rather than of any one
 * thing on screen.
 *
 * @param boardRef ref to the GameCanvas, which owns canvas geometry and the
 *        rAF loop.
 */
export function useAbaloneGame(
  boardRef: RefObject<GameCanvasHandle | null>,
) {
  //'ai' = vs computer, 'local' = pass & play
  const [mode, setModeState] = useState<GameMode>("ai")
  const [difficulty, setDifficulty] = useState(1)
  const [setupType, setSetupType] = useState<SetupKey>(DEFAULT_SETUP)
  // What the player picked ('random' included) vs. the colour they end up with.
  const [colorChoice, setColorChoice] = useState<ColorChoiceValue>("black")
  const [playerColor, setPlayerColor] = useState<Player>("black")

  const [phase, setPhase] = useState<GamePhase>("pregame")
  const [state, setState] = useState<GameState>(() =>
    createGameState(DEFAULT_SETUP, "black", "ai"),
  )
  const [aiThinking, setAiThinking] = useState(false)
  const [hintThinking, setHintThinking] = useState(false)
  const [gameOverModalOpen, setGameOverModalOpen] = useState(false)

  // Read off the board, not off the bot's last reply — so it answers for the
  // move you just played, and for the one that wins the game. Rewinding the
  // history moves the board, so the bar follows it back.
  const evalScore = useMemo(() => evaluateBoard(state), [state])

  const [marbleDesign, setMarbleDesignState] = useMarbleDesign()
  const [showCoordinates, setShowCoordinates] = useState(false)
  const [showEvalBar, setShowEvalBar] = useState(false)
  const [animationsEnabled, setAnimationsEnabled] =
    usePersistentState<boolean>(
      "abalone-animations-enabled",
      prefersReducedMotion() ? false : ANIMATE_BY_DEFAULT,
      (raw) => {
        if (raw === "true") return true
        if (raw === "false") return false
        return null
      },
      String,
    )
  const [autoRotate, setAutoRotate] = usePersistentState<boolean>(
    `${PREF_PREFIX}autoRotateBoard`,
    true,
    (raw) => {
      const saved = parseStored(raw)
      return typeof saved === "boolean" ? saved : null
    },
    serialize,
  )
  const [soundVolume, setSoundVolumeState] = usePersistentState<number>(
    `${PREF_PREFIX}soundVolume`,
    DEFAULT_VOLUME,
    (raw) => {
      const saved = parseStored(raw)
      if (typeof saved !== "number" || !Number.isFinite(saved)) return null
      return Math.min(Math.max(saved, 0), 1)
    },
    serialize,
  )
  const [soundMuted, setSoundMutedState] = usePersistentState<boolean>(
    `${PREF_PREFIX}soundMuted`,
    false,
    (raw) => parseStored(raw) === true,
    serialize,
  )
  const [localNames, setLocalNames] = usePersistentState<LocalNames>(
    `${PREF_PREFIX}localPlayerNames`,
    NO_LOCAL_NAMES,
    (raw) => {
      const saved = parseStored(raw)
      if (!saved || typeof saved !== "object") return null
      return { ...NO_LOCAL_NAMES, ...(saved as Partial<LocalNames>) }
    },
    serialize,
  )

  // Refs mirror state for use inside async flows and effects that must not
  // re-subscribe on every state change.
  const stateRef = useRef(state)
  stateRef.current = state
  const phaseRef = useRef(phase)
  phaseRef.current = phase
  const animationsEnabledRef = useRef(animationsEnabled)
  animationsEnabledRef.current = animationsEnabled

  const busyRef = useRef(false) // a move (and its animation) is in flight
  const botRef = useRef<BotClient | null>(null)
  const hintBotRef = useRef<BotClient | null>(null) // created on the first hint, never before
  const aiRequestedForRef = useRef<string | null>(null) // guards against duplicate AI requests
  const gameStartTimeRef = useRef<number | null>(null)

  if (botRef.current === null) botRef.current = new BotClient()

  useEffect(
    () => () => {
      botRef.current?.disconnect()
      hintBotRef.current?.disconnect()
    },
    [],
  )

  const possibleMoves = useMemo(
    () =>
      getPossibleMoves(state, state.selectedMarbles, isBlackTurn(state)),
    [state],
  )

  const aiColor: Player = playerColor === "black" ? "white" : "black"
  const viewingHistory = isViewingHistory(state)

  /**
   * In hot-seat play the board can rotate so the side to move always sits at
   * the bottom. Orientation is a view concern, so it is derived rather than
   * stored — the underlying state is untouched.
   *
   * The turn flips the instant the move is committed, but rotating there would
   * spin the board while the marbles are still settling and leave the player
   * who just moved unable to read the result. So the flip trails the committed
   * state by BOARD_FLIP_DELAY — the animation has already finished by then,
   * since executeMove only commits once it resolves.
   */
  const rotatesWithTurn = mode === "local" && autoRotate
  const [displayFlip, setDisplayFlip] = useState(false)
  const wasReviewingRef = useRef(false)

  useEffect(() => {
    if (!rotatesWithTurn) return undefined

    // Reviewing holds the board still. Every position in the history belonged to
    // one side or the other, so following the turn back through them would spin
    // the board on every step — and reading a game back is the one time you are
    // watching the board rather than playing on it. The orientation you were
    // looking at when you stepped back is the one the whole review is read in.
    if (viewingHistory) {
      wasReviewingRef.current = true
      return undefined
    }

    const returning = wasReviewingRef.current
    wasReviewingRef.current = false

    const target = state.currentTurn === "white"
    if (target === displayFlip) return undefined
    // Coming back to the live position is a jump, and a jump lands. The delay
    // below is there to let the player who just moved see the result before the
    // board turns around, which is not what this is.
    if (returning) {
      setDisplayFlip(target)
      return undefined
    }
    const timer = setTimeout(
      () => setDisplayFlip(target),
      TIMING.BOARD_FLIP,
    )
    return () => clearTimeout(timer)
  }, [displayFlip, rotatesWithTurn, state.currentTurn, viewingHistory])

  const viewState = useMemo(() => {
    if (!rotatesWithTurn) return state
    return state.shouldFlipBoard === displayFlip
      ? state
      : { ...state, shouldFlipBoard: displayFlip }
  }, [displayFlip, rotatesWithTurn, state])

  /* ---------------------------------------------------------------- *
   * Move execution
   * ---------------------------------------------------------------- */

  const executeMove = useCallback(
    async (selection: CellName[], destination: CellName) => {
      const current = stateRef.current
      const { state: nextState, result } = makeMove(
        current,
        selection,
        destination,
      )
      if (!result) return null

      busyRef.current = true
      try {
        // The tap that played this move is the only moment a browser will let
        // the audio device be woken, and it has to be taken before anything is
        // awaited — so it is taken here, whether or not this move makes a sound.
        primeSounds()

        // Show the pre-move board with the selection locked in and the previous
        // move's arrows cleared, then animate onto the new position.
        setState({
          ...current,
          selectedMarbles: selection,
          hoveredCell: null,
          lastMove: null,
        })

        if (animationsEnabledRef.current && boardRef.current) {
          await boardRef.current.animateMove({
            movingMarbles: result.movingMarbles,
            direction: result.direction,
          })
        }

        // With the marbles down, not as they set off: the sound of a move is
        // the sound of it landing. `movingMarbles` counts both sides — a line of
        // three shoving two is five marbles hitting the board at once.
        playMoveSound(result.movingMarbles.length)
        if (result.isCapture) playFallSound()

        setState(nextState)
        return nextState
      } finally {
        busyRef.current = false
      }
    },
    [boardRef],
  )

  /* ---------------------------------------------------------------- *
   * Game lifecycle
   * ---------------------------------------------------------------- */

  const startNewGame = useCallback(
    async (options: NewGameOptions = {}) => {
      const {
        setupType: nextSetup = setupType,
        colorChoice: nextChoice = colorChoice,
        difficulty: nextDifficulty = difficulty,
        mode: nextMode = mode,
        pregame = false,
      } = options

      // Going back to the setup screen must not spend the coin flip; hot-seat
      // play always starts from black's side.
      let nextColor: Player
      if (nextMode === "local") nextColor = "black"
      else if (pregame) {
        nextColor = nextChoice === "random" ? "black" : nextChoice
      } else nextColor = resolveColor(nextChoice)

      const fresh = createGameState(nextSetup, nextColor, nextMode)
      aiRequestedForRef.current = null
      busyRef.current = false

      setModeState(nextMode)
      setSetupType(nextSetup)
      setColorChoice(nextChoice)
      setPlayerColor(nextColor)
      setDifficulty(nextDifficulty)
      setState(fresh)
      setDisplayFlip(false) // a fresh board always starts with black at the bottom
      setGameOverModalOpen(false)
      setAiThinking(false)

      if (pregame) {
        setPhase("pregame")
        gameStartTimeRef.current = null
        return fresh
      }

      // Pressing play is a gesture, and against a bot playing black it is the
      // last one before a move is made — so the sound is woken here too.
      primeSounds()

      if (nextMode === "ai") await botRef.current?.connect(nextDifficulty)
      gameStartTimeRef.current = Date.now()
      setPhase("ingame")
      return fresh
    },
    [colorChoice, difficulty, mode, setupType],
  )

  // A rematch keeps the colour that was actually played, not the coin flip.
  const handleRematch = useCallback(
    () =>
      startNewGame({
        setupType: state.setupType,
        colorChoice: state.playerColor,
        mode: state.mode,
      }),
    [startNewGame, state.mode, state.playerColor, state.setupType],
  )

  const handleNewBot = useCallback(
    () => startNewGame({ setupType, colorChoice, mode, pregame: true }),
    [colorChoice, mode, setupType, startNewGame],
  )

  const handleResign = useCallback(() => {
    // In hot-seat play the side to move is the one giving up.
    setState((s) =>
      resignGame(s, s.mode === "local" ? s.currentTurn : s.playerColor),
    )
    setPhase("postgame")
    setGameOverModalOpen(true)
  }, [])

  // Enter postgame as soon as the board reports the game is over.
  useEffect(() => {
    if (phase === "ingame" && state.gameOver) {
      setPhase("postgame")
      setGameOverModalOpen(true)
    }
  }, [phase, state.gameOver])

  /* ---------------------------------------------------------------- *
   * Board interaction
   * ---------------------------------------------------------------- */

  const setHoveredCell = useCallback((pos: CellName | null) => {
    setState((s) =>
      s.hoveredCell === pos ? s : { ...s, hoveredCell: pos },
    )
  }, [])

  const handleCellClick = useCallback(
    async (pos: CellName) => {
      const current = stateRef.current
      if (current.gameOver || busyRef.current) return
      if (isViewingHistory(current)) return // no branching off a rewound position

      const moves = getPossibleMoves(
        current,
        current.selectedMarbles,
        isBlackTurn(current),
      )

      if (moves.includes(pos)) {
        await executeMove([...current.selectedMarbles], pos)
        return
      }

      const color = getMarbleAt(current, pos)

      if (!color) {
        setState((s) => ({ ...s, selectedMarbles: [], hoveredCell: null }))
        return
      }
      if (!isValidSelection(current, pos)) return

      const nextSelection = current.selectedMarbles.includes(pos)
        ? deselectMarble(current.selectedMarbles, pos)
        : selectMarble(current, current.selectedMarbles, pos, color)

      setState((s) => ({
        ...s,
        selectedMarbles: nextSelection,
        hoveredCell: null,
      }))
    },
    [executeMove],
  )

  /**
   * Drag-selection: the marble the drag started on, through to the one under the
   * cursor now. Returns how many marbles it picked, or 0 if it took nothing —
   * the board uses that both to swallow the click a mouse release fires (which
   * would otherwise land on the last marble of the run and deselect it) and to
   * stop asking once the run is full.
   */
  const handleDragSelect = useCallback(
    (anchor: CellName, pos: CellName) => {
      const current = stateRef.current
      if (current.gameOver || busyRef.current) return 0
      if (isViewingHistory(current)) return 0
      if (!isValidSelection(current, anchor)) return 0

      const run = selectRun(current, anchor, pos)
      // Dragged off the line, or past its end. Hold what the drag has so far
      // rather than dropping it: overshooting a three-marble run by a pixel should
      // not empty the selection you just made.
      if (!run) return 0

      setState((s) =>
        s.selectedMarbles.length === run.length &&
        run.every((p, i) => s.selectedMarbles[i] === p)
          ? s
          : { ...s, selectedMarbles: run },
      )
      return run.length
    },
    [],
  )

  /* ---------------------------------------------------------------- *
   * AI turn
   * ---------------------------------------------------------------- */

  useEffect(() => {
    if (mode !== "ai") return // hot-seat games have no AI turn
    if (phase !== "ingame") return
    if (state.gameOver || viewingHistory) return
    if (state.currentTurn !== aiColor) return
    if (busyRef.current) return

    // One request per position; guards against StrictMode's double effect run.
    const key = `${state.currentMoveIndex}:${state.currentTurn}`
    if (aiRequestedForRef.current === key) return
    aiRequestedForRef.current = key

    let cancelled = false

    void (async () => {
      setAiThinking(true)
      try {
        await new Promise((resolve) =>
          setTimeout(resolve, TIMING.BOT_REPLY),
        )
        if (cancelled) return

        const response = await botRef.current?.requestMove(
          toSearchState(stateRef.current),
        )
        if (cancelled || !response?.selection || !response?.move) return

        const current = stateRef.current
        const legal = getPossibleMoves(
          current,
          response.selection,
          isBlackTurn(current),
        )
        if (!legal.includes(response.move)) {
          console.error("Invalid AI move", response)
          return
        }

        await executeMove(response.selection, response.move)
      } catch (error) {
        console.error("AI move failed:", error)
      } finally {
        if (!cancelled) setAiThinking(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [
    aiColor,
    executeMove,
    mode,
    phase,
    state.currentMoveIndex,
    state.currentTurn,
    state.gameOver,
    viewingHistory,
  ])

  /* ---------------------------------------------------------------- *
   * History navigation
   * ---------------------------------------------------------------- */

  const goPrevMove = useCallback(() => setState((s) => prevMove(s)), [])
  const goNextMove = useCallback(() => setState((s) => nextMove(s)), [])
  const goToMoveIndex = useCallback(
    (index: number) => setState((s) => goToMove(s, index)),
    [],
  )
  const goToLatestMove = useCallback(
    () => setState((s) => goToMove(s, s.moveHistory.length - 1)),
    [],
  )

  /* ---------------------------------------------------------------- *
   * Hint and take-back
   * ---------------------------------------------------------------- */

  /**
   * Asks the engine what it would play and shows it on the board with nothing
   * more than the highlights that already exist: the marbles to move come up
   * selected, and pointing the hover at the destination draws the same arrows a
   * player would get from hovering it themselves. Tapping that square plays it.
   *
   * Only against a bot: in hot-seat play both sides are at the same screen, so
   * a hint would be advice one player gives the other.
   */
  const requestHint = useCallback(async () => {
    const current = stateRef.current
    if (
      phaseRef.current !== "ingame" ||
      current.gameOver ||
      busyRef.current
    ) {
      return
    }
    if (isViewingHistory(current)) return
    if (
      current.mode === "local" ||
      current.currentTurn !== current.playerColor
    ) {
      return
    }

    setHintThinking(true)
    try {
      if (!hintBotRef.current) {
        hintBotRef.current = new BotClient()
        await hintBotRef.current.connect(HINT_LEVEL)
      }

      const response = await hintBotRef.current.requestMove(
        toSearchState(current),
      )
      if (!response?.selection || !response?.move) return

      // The game may have moved on while the search ran.
      const now = stateRef.current
      if (
        now.currentMoveIndex !== current.currentMoveIndex ||
        now.gameOver
      ) {
        return
      }

      const legal = getPossibleMoves(
        now,
        response.selection,
        isBlackTurn(now),
      )
      if (!legal.includes(response.move)) return

      setState((s) => ({
        ...s,
        selectedMarbles: response.selection ?? [],
        hoveredCell: response.move,
      }))
    } catch (error) {
      console.error("Hint failed:", error)
    } finally {
      setHintThinking(false)
    }
  }, [])

  /** Takes back the last move (both sides' against a bot) and resumes there. */
  const undoMove = useCallback(() => {
    const current = stateRef.current
    if (
      phaseRef.current !== "ingame" ||
      current.gameOver ||
      busyRef.current
    ) {
      return
    }
    if (undoTargetIndex(current) < 0) return

    // The bot has to be free to think about this position again, and whatever
    // it was searching for the discarded one no longer means anything.
    aiRequestedForRef.current = null
    setAiThinking(false)
    setState((s) => truncateToMove(s, undoTargetIndex(s)))
  }, [])

  /* ---------------------------------------------------------------- *
   * Pregame settings — the board doubles as a live preview
   * ---------------------------------------------------------------- */

  const previewSetup = useCallback(
    (nextSetup: SetupKey, nextColor: Player, nextMode: GameMode) => {
      setState(createGameState(nextSetup, nextColor, nextMode))
      setDisplayFlip(false)
    },
    [],
  )

  const chooseSetup = useCallback(
    (nextSetup: SetupKey) => {
      setSetupType(nextSetup)
      if (phaseRef.current === "pregame") {
        previewSetup(nextSetup, playerColor, mode)
      }
    },
    [mode, playerColor, previewSetup],
  )

  const chooseColor = useCallback(
    (nextChoice: ColorChoiceValue) => {
      setColorChoice(nextChoice)
      // An unresolved 'random' previews from black's side.
      const nextColor = nextChoice === "random" ? "black" : nextChoice
      setPlayerColor(nextColor)
      if (phaseRef.current === "pregame") {
        previewSetup(setupType, nextColor, mode)
      }
    },
    [mode, previewSetup, setupType],
  )

  const chooseMode = useCallback(
    (nextMode: GameMode) => {
      setModeState(nextMode)
      // Hot-seat always starts with black at the bottom; the colour picker only
      // makes sense when there is an opponent to assign the other colour to.
      const nextColor: Player =
        nextMode === "local" || colorChoice === "random"
          ? "black"
          : colorChoice
      setPlayerColor(nextColor)
      if (phaseRef.current === "pregame") {
        previewSetup(setupType, nextColor, nextMode)
      }
    },
    [colorChoice, previewSetup, setupType],
  )

  /* ---------------------------------------------------------------- *
   * Persisted display preferences
   * ---------------------------------------------------------------- */

  // The sound module keeps its own copy of these so a move can be played from
  // anywhere without threading them through; this is what puts the saved values
  // there on load, and keeps them in step after.
  useEffect(() => setSoundVolume(soundVolume), [soundVolume])
  useEffect(() => setSoundMuted(soundMuted), [soundMuted])

  const setMarbleDesign = useCallback(
    (design: string) => {
      if (!hasDesign(design)) return
      setMarbleDesignState(design)
    },
    [setMarbleDesignState],
  )

  /**
   * Touching the slider takes the sound off mute. Reaching for the volume is
   * already the whole of "I want to hear this" — making someone say it twice,
   * once on the slider and once on the button, is the kind of thing that gets
   * called a bug.
   */
  const setVolume = useCallback(
    (next: number) => {
      setSoundVolumeState(next)
      setSoundMutedState(false)
    },
    [setSoundMutedState, setSoundVolumeState],
  )

  const setMuted = useCallback(
    (next: boolean) => {
      setSoundMutedState(next)
      // Coming off mute is worth hearing. The module is told before the preview
      // rather than waiting on the effect below, which would arrive one render
      // too late and swallow the very sound it is announcing.
      if (!next) {
        setSoundMuted(false)
        playMoveSound(1)
      }
    },
    [setSoundMutedState],
  )

  /**
   * Kept between games rather than reset with each one: two people sharing a
   * device are the same two people next game, and retyping their names every
   * time you press play would be the opposite of a convenience.
   */
  const setLocalName = useCallback(
    (color: Player, name: string) => {
      setLocalNames({
        ...localNames,
        [color]: name.slice(0, MAX_LOCAL_NAME),
      })
    },
    [localNames, setLocalNames],
  )

  const gameDurationSeconds = useCallback(
    () =>
      gameStartTimeRef.current
        ? Math.floor((Date.now() - gameStartTimeRef.current) / 1000)
        : 0,
    [],
  )

  return {
    // state — `state` carries the view orientation, which may differ from the
    // stored one while the board auto-rotates in hot-seat play.
    state: viewState,
    phase,
    mode,
    possibleMoves,
    aiThinking,
    hintThinking,
    evalScore,
    viewingHistory,
    canPrev: canPrevMove(state),
    canNext: canNextMove(state),
    // Stepping forward once would already get you there when only one move
    // behind, so the shortcut only earns its place beyond that.
    canSkipToLatest:
      state.moveHistory.length - 1 - state.currentMoveIndex > 1,
    // Both act on the live position, so neither is offered while the game is
    // over, rewound, or waiting on the opponent. A hint needs a side to advise,
    // which hot-seat play does not have.
    canHint:
      phase === "ingame" &&
      mode !== "local" &&
      !state.gameOver &&
      !viewingHistory &&
      !hintThinking &&
      state.currentTurn === playerColor,
    canUndo:
      phase === "ingame" && !state.gameOver && undoTargetIndex(state) >= 0,
    playerColor,
    colorChoice,
    aiColor,
    setupType,
    difficulty,
    gameOverModalOpen,

    // display preferences
    marbleDesign,
    showCoordinates,
    showEvalBar,
    animationsEnabled,
    autoRotate,
    soundVolume,
    soundMuted,

    // actions
    startNewGame,
    handleRematch,
    handleNewBot,
    handleResign,
    handleCellClick,
    handleDragSelect,
    setHoveredCell,
    goPrevMove,
    goNextMove,
    goToMoveIndex,
    goToLatestMove,
    requestHint,
    undoMove,
    chooseSetup,
    chooseColor,
    chooseMode,
    setDifficulty,
    setMarbleDesign,
    localNames,
    setLocalName,
    setShowCoordinates,
    setShowEvalBar,
    setAnimationsEnabled,
    setAutoRotate,
    setSoundVolume: setVolume,
    setSoundMuted: setMuted,
    closeGameOverModal: () => setGameOverModalOpen(false),
    gameDurationSeconds,
  }
}
