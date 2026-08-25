import type { GameState } from "@repo/abalone-engine/game-state"
import {
  canNextMove,
  canPrevMove,
  createGameState,
  getMarbleAt,
  goToMove,
  isBlackTurn,
  isValidSelection,
  makeMove,
} from "@repo/abalone-engine/game-state"
import {
  deselectMarble,
  getPossibleMoves,
  selectMarble,
  selectRun,
} from "@repo/abalone-engine/rules"
import type { CellName, Player } from "@repo/abalone-engine/types"
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import type { RefObject } from "react"
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import type { GameCanvasHandle } from "@/components/game-canvas"
import {
  playMoveMutationOptions,
  resignGameMutationOptions,
} from "@/data/online/mutations"
import type { Game, GameMove } from "@/data/online/queries"
import {
  gameMovesQueryOptions,
  gameQueryOptions,
  onlineKeys,
} from "@/data/online/queries"
import { useApiError } from "@/hooks/use-api-error"
import { useAnimationsEnabled } from "@/hooks/use-app-preferences"
import { useAuth } from "@/providers/auth-provider"
import { useRealtime } from "@/providers/realtime-provider"
import { TIMING } from "@/render/motion"
import { playFallSound, playMoveSound, primeSounds } from "@/utils/sound"
import type { SyncState } from "@/utils/sync-state"
import { syncStateOf } from "@/utils/sync-state"

/**
 * How often the board asks whether anything has happened.
 *
 * Quick while it is the opponent's move, because that is the only time
 * something can happen. Slow while it is yours, where the only news would be
 * them resigning.
 */
const POLL_WAITING_MS = 3_000
const POLL_MY_TURN_MS = 15_000

/** How long an arriving move is given to play out before it is given up on. */
const ANIMATION_CEILING_MS = TIMING.MOVE * 4

/** Which seat a player holds, or null when they are only watching. */
function seatOf(game: Game, userId: string): Player | null {
  if (game.black.userId === userId) return "black"
  if (game.white.userId === userId) return "white"
  return null
}

/** One stored ply, as the engine's own history entry. */
function toHistoryEntry(move: GameMove) {
  const moved: Player = move.currentTurn === "black" ? "white" : "black"

  return {
    black: move.blackCells,
    white: move.whiteCells,
    blackScore: move.blackScore,
    whiteScore: move.whiteScore,
    currentTurn: move.currentTurn,
    //ply 0 is the opening, which nobody moved into
    moveDetails:
      move.marbles && move.destination && move.direction
        ? {
            marbles: move.marbles,
            destination: move.destination,
            capturedMarble: null,
            marbleCount: move.marbles.length,
            isPush: move.isPush,
            isCapture: move.isCapture,
            shovedMarbles: move.shovedMarbles,
            direction: move.direction,
            color: moved,
          }
        : undefined,
  }
}

/**
 * The game the server is holding, as the state the board draws.
 *
 * The move log is a 1:1 image of the engine's own history, so this is a mapping
 * rather than a replay: no move is played again to get here. `goToMove` then
 * does the rest, which is how the board, the scores and the arrows over the
 * last move all end up describing the same ply.
 */
export function toGameState(
  game: Game,
  moves: GameMove[],
  mySeat: Player,
  viewIndex: number | null,
): GameState {
  const moveHistory = moves.map(toHistoryEntry)
  const latest = Math.max(0, moveHistory.length - 1)

  const base: GameState = {
    ...createGameState(game.setupType, mySeat, "online"),
    moveHistory,
    currentMoveIndex: latest,
    playerColor: mySeat,
    setupType: game.setupType,
    mode: "online",
    shouldFlipBoard: mySeat === "white",
    gameOver: game.status === "finished",
    gameOverReason: game.finishReason,
    winner: game.winner,
  }

  return goToMove(base, Math.min(viewIndex ?? latest, latest))
}

export type OnlineGame = {
  game?: Game
  state: GameState
  mySeat: Player | null
  possibleMoves: CellName[]
  isLoading: boolean
  /** How current the board is. See `SyncState`. */
  sync: SyncState
  viewingHistory: boolean
  canPrev: boolean
  canNext: boolean
  canSkipToLatest: boolean
  /** Whether the board should take a tap at all. */
  interactive: boolean
  /** Whatever the last request said, already translated. */
  error?: string
  isResigning: boolean
  handleCellClick: (pos: CellName) => void
  handleDragSelect: (anchor: CellName, pos: CellName) => number
  setHoveredCell: (pos: CellName | null) => void
  goPrevMove: () => void
  goNextMove: () => void
  goToMoveIndex: (index: number) => void
  goToLatestMove: () => void
  resign: () => void
}

/**
 * One correspondence game: what the server holds, and what this device can do
 * about it.
 *
 * Deliberately not an extension of `useAbaloneGame`. That hook owns a bot
 * connection, difficulty, the pregame panel, hot-seat names and board rotation,
 * none of which exist here — and the one thing they would share, the rules, is
 * the engine both of them already call.
 *
 * The server is the authority, so there is no rollback snapshot: a move that is
 * refused is not undone, it is simply never believed. The board goes back to
 * whatever the server says, because that is what the game actually is.
 */
export function useOnlineGame(
  gameId: string,
  boardRef: RefObject<GameCanvasHandle | null>,
): OnlineGame {
  const { user } = useAuth()
  const { isConnected } = useRealtime()
  const queryClient = useQueryClient()
  const translateError = useApiError()
  const [animationsEnabled] = useAnimationsEnabled()

  const myUserId = user?.id ?? ""

  const gameQuery = useQuery({
    ...gameQueryOptions(gameId),
    //a finished game never changes again, so it stops being asked about — no
    //poll, and nothing on a remount or a window focus either. that last part is
    //what makes reading an old game back work with the network off: the saved
    //copy is not merely painted first, it is believed.
    staleTime: ({ state }) =>
      state.data?.status === "finished" ? Number.POSITIVE_INFINITY : 0,
    //while the channel is up the server says when the row moved, so the timer
    //stands down. it is not deleted: a blocked websocket, a sleeping phone or a
    //network that hates upgrades all land here as `false`, and the board goes
    //back to the three seconds it always had.
    refetchInterval: ({ state }) => {
      if (isConnected) return false
      const row = state.data
      if (!row || row.status !== "active") return false
      return seatOf(row, myUserId) === row.currentTurn
        ? POLL_MY_TURN_MS
        : POLL_WAITING_MS
    },
    refetchOnWindowFocus: true,
  })

  const movesQuery = useQuery(gameMovesQueryOptions(gameId))

  //clips are fetched on first use, and the first use on this screen is usually
  //the opponent's move — which arrives with no tap behind it to wake the audio
  //device or warm anything. the tap that opened the board is the one there is.
  useEffect(() => {
    primeSounds()
  }, [])

  const game = gameQuery.data
  const moves = useMemo(() => movesQuery.data ?? [], [movesQuery.data])
  const mySeat = game ? seatOf(game, myUserId) : null

  /**
   * The poll notices; this fetches.
   *
   * `moveCount` is the whole reason the row and the plies are two requests: the
   * row is what comes back every few seconds, and the only thing it has to say
   * is a number. When that number is ahead of the history this device holds —
   * the opponent has played — the plies are worth asking for, and at no other
   * time. Without this the board would poll forever and never repaint.
   */
  const behind =
    !!game && !movesQuery.isFetching && game.moveCount > moves.length - 1

  useEffect(() => {
    if (!behind) return
    void queryClient.invalidateQueries({
      queryKey: onlineKeys.moves(gameId),
    })
  }, [behind, gameId, queryClient])

  /**
   * A game that has ended belongs in the other list.
   *
   * However it ended — resigned here, resigned there, or the sixth marble going
   * off — the two lists are wrong from that moment, and history is cached as
   * never-stale precisely because a finished game does not change. Marking them
   * costs nothing while this screen is open: neither list is being watched from
   * here, so they are refetched when the list is next looked at rather than now.
   */
  const isFinished = game?.status === "finished"

  useEffect(() => {
    if (!isFinished) return
    for (const status of ["active", "finished"] as const) {
      void queryClient.invalidateQueries({
        queryKey: onlineKeys.games(status),
      })
    }
  }, [isFinished, queryClient])

  /**
   * The move this device has played and the server has not confirmed.
   *
   * It stands until the move log catches up with it, then retires itself. That
   * is what keeps the board still through the gap between the mutation
   * answering and the refetched plies arriving, without anything having to
   * remember to clear it.
   */
  const [pending, setPending] = useState<{
    state: GameState
    atIndex: number
  } | null>(null)

  /** Which ply is being looked at. Null is the live one. */
  const [viewIndex, setViewIndex] = useState<number | null>(null)

  /**
   * The position held on screen while the move that leaves it plays out.
   *
   * An arriving ply is a whole move, not a new picture — the marbles slid, and
   * on a push they took the other player's with them. Painting the position it
   * ended in would throw all of that away, so the board is kept one ply behind
   * until the animation that gets it there has finished.
   */
  const [replay, setReplay] = useState<GameState | null>(null)

  //the last ply the board has actually shown. what makes an arriving move worth
  //playing out is being exactly one past this: a longer jump is a cold start or
  //a tab that was in the background, and a flurry of moves at once is not
  //something anybody is watching.
  const shownIndexRef = useRef(-1)
  const viewIndexRef = useRef(viewIndex)
  viewIndexRef.current = viewIndex

  //the marbles picked up, and the square under the pointer. the only part of
  //this screen that is this device's own — everything else belongs to the
  //server, which is why it is held apart rather than written into the board.
  const [selection, setSelection] = useState<CellName[]>([])
  const [hovered, setHovered] = useState<CellName | null>(null)

  const serverState = useMemo(() => {
    if (!game || moves.length === 0) {
      return createGameState(undefined, "black", "online")
    }
    return toGameState(game, moves, mySeat ?? "black", viewIndex)
  }, [game, moves, mySeat, viewIndex])

  const isPendingLive =
    pending !== null && moves.length - 1 < pending.atIndex
  const position = isPendingLive ? pending.state : (replay ?? serverState)

  /**
   * The opponent's move, played out rather than pasted in.
   *
   * The stored ply carries the marbles and where they went, which is what the
   * engine needs to work out the rest — which marbles travel, a pushed line
   * included, and in which direction. So the move is handed back to `makeMove`
   * from the position before it, and the board is given the same thing it is
   * given when this device plays: a set of marbles and a step to move them.
   *
   * Skipped while the game is being read back, while a tab is in the background
   * (an animation nothing is painting would never finish, and would strand the
   * board on the old position), and when animations are off.
   *
   * A *layout* effect, and that part is load-bearing. The plies arriving is what
   * schedules this, so by the time it runs React has already committed a render
   * holding the position the move ends in — the board drawn at its destination
   * and the new move written into the record. Held back until after the paint,
   * this would show that, take it away, and put it back when the animation
   * finished: the move landing twice with a blink between. Running before the
   * paint is what makes the whole thing one frame instead of three.
   */
  useLayoutEffect(() => {
    const latest = moves.length - 1
    if (!game || !mySeat || latest < 0 || replay) return

    const shown = shownIndexRef.current
    if (shown >= latest) return
    shownIndexRef.current = latest

    if (latest - shown !== 1) return
    if (!animationsEnabled || viewIndexRef.current !== null) return
    if (document.hidden) return

    const ply = moves[latest]
    const board = boardRef.current
    if (!board || !ply?.marbles || !ply.destination) return

    //the game as it stood one ply ago, and *only* that: the plies after it
    //truncated rather than rewound, so the board does not announce that it is
    //showing an old position, and the result cleared, so a game the arriving
    //move ends does not put its modal up over the move that ends it
    const before: GameState = {
      ...toGameState(game, moves.slice(0, latest), mySeat, null),
      gameOver: false,
      gameOverReason: null,
      winner: null,
      lastMove: null,
    }

    const { result } = makeMove(before, ply.marbles, ply.destination)
    if (!result) return

    setReplay(before)

    //the board is driven by requestAnimationFrame, which a browser stops
    //serving to a tab nobody is looking at — so an animation that starts just
    //as the tab goes away has no frame on which to finish, and the hold it is
    //waiting on would keep the board a move behind until the tab came back.
    //whichever settles first wins, and the ceiling is far enough past a move
    //that reaching it means the frames stopped rather than that they were slow.
    const settled = Promise.race([
      board
        .animateMove({
          movingMarbles: result.movingMarbles,
          direction: result.direction,
        })
        .then(() => {
          playMoveSound(result.movingMarbles.length)
          if (result.isCapture) playFallSound()
        }),
      new Promise((resolve) => setTimeout(resolve, ANIMATION_CEILING_MS)),
    ])
    void settled.finally(() => setReplay(null))
  }, [moves, game, mySeat, replay, animationsEnabled, boardRef])

  const state = useMemo(
    () => ({
      ...position,
      selectedMarbles: selection,
      hoveredCell: hovered,
    }),
    [position, selection, hovered],
  )

  const stateRef = useRef(state)
  stateRef.current = state
  const busyRef = useRef(false)

  const possibleMoves = useMemo(
    () =>
      getPossibleMoves(state, state.selectedMarbles, isBlackTurn(state)),
    [state],
  )

  const play = useMutation({
    ...playMoveMutationOptions,
    onSuccess: async (row) => {
      //this device has already watched this move: it played it. marking it
      //shown before the plies are asked for is what stops it arriving back and
      //being played out a second time. only on success — a refused move was
      //never on the board, so nothing was shown.
      shownIndexRef.current = row.moveCount
      queryClient.setQueryData(onlineKeys.game(gameId), row)
      await queryClient.invalidateQueries({
        queryKey: onlineKeys.moves(gameId),
      })
    },
    //believing the server is the whole rollback: dropping what this device
    //played leaves the board showing the position the game is actually in
    onError: () => setPending(null),
  })

  const resignGame = useMutation({
    ...resignGameMutationOptions,
    onSuccess: (row) =>
      queryClient.setQueryData(onlineKeys.game(gameId), row),
  })

  const viewingHistory =
    state.currentMoveIndex < state.moveHistory.length - 1

  const interactive =
    !!game &&
    game.status === "active" &&
    mySeat !== null &&
    mySeat === game.currentTurn &&
    !viewingHistory &&
    //the row already says it is your turn while their move is still sliding
    //across the board, and a tap landing in that gap would play from a position
    //nobody has been shown yet
    replay === null &&
    !play.isPending

  const executeMove = useCallback(
    async (selection: CellName[], destination: CellName) => {
      const current = stateRef.current
      const row = gameQuery.data
      if (!row || busyRef.current) return

      const { state: next, result } = makeMove(
        current,
        selection,
        destination,
      )
      //an illegal move never leaves the device. the server would refuse it
      //too, and a round trip to be told so is a round trip for nothing.
      if (!result) return

      busyRef.current = true
      try {
        //the tap that played this is the only moment a browser will let the
        //audio device be woken, and it has to be taken before anything awaits
        primeSounds()

        //the marbles are down and the last move's arrows are gone before the
        //animation starts, so what plays out is this move rather than the one
        //before it clearing up
        setHovered(null)
        setPending({
          state: { ...current, lastMove: null },
          atIndex: row.moveCount + 1,
        })

        if (animationsEnabled && boardRef.current) {
          await boardRef.current.animateMove({
            movingMarbles: result.movingMarbles,
            direction: result.direction,
          })
        }

        playMoveSound(result.movingMarbles.length)
        if (result.isCapture) playFallSound()

        setSelection([])
        setPending({ state: next, atIndex: row.moveCount + 1 })
        setViewIndex(null)

        play.mutate({
          gameId,
          marbles: selection,
          destination,
          moveIndex: row.moveCount,
        })
      } finally {
        busyRef.current = false
      }
    },
    [animationsEnabled, boardRef, gameId, gameQuery.data, play.mutate],
  )

  const setHoveredCell = useCallback(
    (pos: CellName | null) => setHovered(pos),
    [],
  )

  const handleCellClick = useCallback(
    (pos: CellName) => {
      const current = stateRef.current
      if (!interactive || busyRef.current) return

      const moveTo = getPossibleMoves(
        current,
        current.selectedMarbles,
        isBlackTurn(current),
      )
      if (moveTo.includes(pos)) {
        void executeMove([...current.selectedMarbles], pos)
        return
      }

      const color = getMarbleAt(current, pos)
      if (!color) {
        setSelection([])
        return
      }
      if (!isValidSelection(current, pos)) return

      setSelection(
        current.selectedMarbles.includes(pos)
          ? deselectMarble(current.selectedMarbles, pos)
          : selectMarble(current, current.selectedMarbles, pos, color),
      )
      setHovered(null)
    },
    [executeMove, interactive],
  )

  const handleDragSelect = useCallback(
    (anchor: CellName, pos: CellName) => {
      const current = stateRef.current
      if (!interactive || busyRef.current) return 0
      if (!isValidSelection(current, anchor)) return 0

      const run = selectRun(current, anchor, pos)
      if (!run) return 0

      const same =
        current.selectedMarbles.length === run.length &&
        run.every((cell, index) => current.selectedMarbles[index] === cell)
      if (!same) setSelection(run)
      return run.length
    },
    [interactive],
  )

  const latestIndex = state.moveHistory.length - 1

  /**
   * Steps the review to a ply, and drops whatever was picked up on the way —
   * those marbles were on a board that is no longer the one being looked at.
   *
   * Landing on the last ply stores null rather than that number, which is the
   * difference between watching the game and being parked on the position that
   * happens to be last right now. A held index survives the opponent's move, on
   * purpose; a player reading the game back does not want the board yanked out
   * from under them the moment a reply lands.
   */
  const goToMoveIndex = useCallback(
    (index: number) => {
      setSelection([])
      setHovered(null)
      //stepping through the game is opting out of watching the move that is
      //arriving. the hold outranks the review, so leaving it in place would
      //make the buttons do nothing until the marbles had finished moving.
      setReplay(null)
      setViewIndex(index >= latestIndex ? null : Math.max(0, index))
    },
    [latestIndex],
  )

  const failure = play.error ?? resignGame.error ?? gameQuery.error

  //the row is what says whether this device is looking at the game as it
  //stands, and the plies follow from it: a `moveCount` ahead of the history
  //puts the moves query in flight, which lands here as the same "syncing"
  const sync = syncStateOf([gameQuery, movesQuery])

  return {
    game,
    state,
    mySeat,
    possibleMoves,
    isLoading: gameQuery.isPending || movesQuery.isPending,
    sync,
    viewingHistory,
    canPrev: canPrevMove(state),
    canNext: canNextMove(state),
    canSkipToLatest: latestIndex - state.currentMoveIndex > 1,
    interactive,
    error: failure ? translateError(failure) : undefined,
    isResigning: resignGame.isPending,
    handleCellClick,
    handleDragSelect,
    setHoveredCell,
    goPrevMove: () => goToMoveIndex(state.currentMoveIndex - 1),
    goNextMove: () => goToMoveIndex(state.currentMoveIndex + 1),
    goToMoveIndex,
    goToLatestMove: () => goToMoveIndex(latestIndex),
    resign: () => resignGame.mutate(gameId),
  }
}
