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
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"
import type { GameCanvasHandle } from "@/components/game-canvas"
import {
  MoveRefusedError,
  playMoveMutationOptions,
  resignGameMutationOptions,
} from "@/data/online/mutations"
import type { Game, GameMove } from "@/data/online/queries"
import {
  gameMovesQueryOptions,
  gameQueryOptions,
  onlineKeys,
} from "@/data/online/queries"
import { patchHubLists } from "@/data/realtime/invalidate"
import { useApiError } from "@/hooks/use-api-error"
import { useAnimationsEnabled } from "@/hooks/use-app-preferences"
import { useAuth } from "@/providers/auth-provider"
import { useRealtime } from "@/providers/realtime-provider"
import type { MoveFailure } from "@/utils/board-timeline"
import { failedMoveVerdict } from "@/utils/board-timeline"
import type { OnlineBoardLog } from "@/utils/online-board-store"
import { OnlineBoardStore } from "@/utils/online-board-store"
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

/** Which seat a player holds, or null when they are only watching. */
function seatOf(game: Game, userId: string): Player | null {
  if (game.black.userId === userId) return "black"
  if (game.white.userId === userId) return "white"
  return null
}

/** Whether the row's ending, if it has one, is the ending of this ply. */
function isResultAt(game: Game, index: number): boolean {
  return game.status === "finished" && game.moveCount === index
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

  //the row's result belongs to the ply it was reached at, which the row names
  //with its own `moveCount`: a game won by the move these plies do not hold yet
  //is not over on this position. the same rule the board applies to the ply it
  //shows (`isResultAt`), so a cut and a ply played out agree on it.
  const endedHere = isResultAt(game, latest)

  const base: GameState = {
    ...createGameState(game.setupType, mySeat, "online"),
    moveHistory,
    currentMoveIndex: latest,
    playerColor: mySeat,
    setupType: game.setupType,
    mode: "online",
    shouldFlipBoard: mySeat === "white",
    gameOver: endedHere,
    gameOverReason: endedHere ? game.finishReason : null,
    winner: endedHere ? game.winner : null,
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
  /** Gives up, then calls `onSettled` once the server has answered either way. */
  resign: (onSettled?: () => void) => void
}

/** What the board draws before the first ply has arrived. */
const EMPTY_STATE = createGameState(undefined, "black", "online")

/**
 * One correspondence game: what the server holds, and what this device can do
 * about it.
 *
 * Deliberately not an extension of `useAbaloneGame`. That hook owns a bot
 * connection, difficulty, the pregame panel, hot-seat names and board rotation,
 * none of which exist here — and the one thing they would share, the rules, is
 * the engine both of them already call.
 *
 * The board and the panel read one thing: the ply the board shows, which only
 * `OnlineBoardStore` moves (`docs/online-board.md`). The queries are its inputs.
 * They decide when a ply is shown, never what is shown.
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
      if (row?.status !== "active") return false
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
  const plies = movesQuery.data
  const mySeat = game ? seatOf(game, myUserId) : null

  /**
   * The poll notices; this fetches.
   *
   * `moveCount` is the whole reason the row and the plies are two requests: the
   * row is what comes back every few seconds, and the only thing it has to say
   * is a number. When that number is ahead of the history this device holds —
   * the opponent has played, or this device's own move has been acknowledged —
   * the plies are worth asking for, and at no other time. Without this the board
   * would poll forever and never repaint.
   */
  const behind =
    !!game &&
    !movesQuery.isFetching &&
    game.moveCount > (plies?.length ?? 0) - 1

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

  /** Which ply is being looked at. Null is the live one. */
  const [viewIndex, setViewIndex] = useState<number | null>(null)

  //what the store reads at the moment it takes a step, rather than what it was
  //built with. written here and nowhere else.
  const liveRef = useRef({ animationsEnabled, viewIndex })
  liveRef.current = { animationsEnabled, viewIndex }

  //one per game: a store never carries a ply from one game into another
  // biome-ignore lint/correctness/useExhaustiveDependencies: `gameId` is the key a new store is made on, not something the store reads.
  const store = useMemo(
    () =>
      new OnlineBoardStore({
        canAnimate: () =>
          liveRef.current.animationsEnabled &&
          liveRef.current.viewIndex === null &&
          !document.hidden &&
          boardRef.current !== null,
        animate: (move) =>
          boardRef.current?.animateMove(move) ?? Promise.resolve(),
        stopAnimation: () => boardRef.current?.stopAnimation(),
        onPlayed: (outcome) => {
          playMoveSound(outcome.movingMarbles.length)
          if (outcome.isCapture) playFallSound()
        },
      }),
    [gameId, boardRef],
  )

  useEffect(() => {
    store.attach()
    return () => store.detach()
  }, [store])

  //the server renders the store as made: no ply yet, the placeholder board
  const board = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  )

  /**
   * The server's log, as one snapshot. The last index, the move behind each ply
   * and the position a cut lands on all come from the same plies, so a newer
   * row is never mixed with older plies.
   */
  const log = useMemo((): OnlineBoardLog | null => {
    if (!game || !plies || plies.length === 0) return null
    return {
      latest: plies.length - 1,
      moveAt: (index) => {
        const ply = plies[index]
        if (!ply?.marbles || !ply.destination) return undefined
        return { marbles: ply.marbles, destination: ply.destination }
      },
      //the seat is laid over at read time: it is who is looking, not the game
      stateAt: (index) =>
        toGameState(game, plies.slice(0, index + 1), "black", null),
    }
  }, [game, plies])

  useEffect(() => {
    if (log) store.setLog(log)
  }, [store, log])

  //the marbles picked up, and the square under the pointer: the only part of
  //this screen that is this device's own. a selection belongs to the ply it was
  //made on, so it is gone the moment the board shows another one.
  const [selection, setSelection] = useState<{
    at: number
    cells: CellName[]
  } | null>(null)
  const [hovered, setHovered] = useState<CellName | null>(null)

  const shown = board.shown
  const shownIndex = shown?.index ?? -1

  const state = useMemo((): GameState => {
    if (!shown) return EMPTY_STATE

    const seat = mySeat ?? "black"
    const seated: GameState = {
      ...shown.state,
      playerColor: seat,
      shouldFlipBoard: seat === "white",
    }

    //the row's ending shows on the ply it was reached at. A resignation adds
    //no ply, so it lands on the ply already on the board.
    const live: GameState =
      game && isResultAt(game, shown.index)
        ? {
            ...seated,
            gameOver: true,
            gameOverReason: game.finishReason,
            winner: game.winner,
          }
        : seated

    //reading the game back is a view on top of the board, never a move of it
    const viewed =
      viewIndex !== null && viewIndex < shown.index
        ? goToMove(live, viewIndex)
        : live

    return {
      ...viewed,
      selectedMarbles:
        selection?.at === shown.index && viewed === live
          ? selection.cells
          : [],
      hoveredCell: hovered,
    }
  }, [shown, game, mySeat, viewIndex, selection, hovered])

  const stateRef = useRef(state)
  stateRef.current = state

  const possibleMoves = useMemo(
    () =>
      getPossibleMoves(state, state.selectedMarbles, isBlackTurn(state)),
    [state],
  )

  /**
   * A play request that failed is not a refusal on its own: its answer may
   * have been lost after the server played the move. Only a domain error is
   * one. Anything else asks the server for its log until the log has the move
   * (`nextBoardStep` then confirms it, or cuts to a different one there) or
   * `failedMoveVerdict` gives up on it.
   */
  const settleFailedMove = useCallback(
    async (error: Error, index: number) => {
      const failure: MoveFailure =
        error instanceof MoveRefusedError ? "refused" : "unknown"

      for (let refetches = 0; ; refetches++) {
        const logged = queryClient.getQueryData(
          gameMovesQueryOptions(gameId).queryKey,
        )
        const verdict = failedMoveVerdict({
          failure,
          index,
          serverLatest: (logged?.length ?? 0) - 1,
          refetches,
        })
        if (verdict === "settled") return
        if (verdict === "refused") {
          store.refuse(index, error)
          //the game moved on, or the move was not legal on it: either way
          //the row says where it stands now
          void queryClient.invalidateQueries({
            queryKey: onlineKeys.game(gameId),
            exact: true,
          })
          return
        }
        //the row and its plies (the key is a prefix of the plies' key)
        await queryClient.refetchQueries({
          queryKey: onlineKeys.game(gameId),
        })
      }
    },
    [gameId, queryClient, store],
  )

  const play = useMutation({
    ...playMoveMutationOptions,
    //what tells this device's own beacon apart from the opponent's: while this
    //is in flight, the answer to it is the thing that will write the row, so
    //the echo announcing it is dropped rather than raced with.
    mutationKey: onlineKeys.write(gameId),
    //the row and nothing else. a `moveCount` one ahead of the plies is what asks
    //for them (`behind`), and the plies are what confirm the move
    onSuccess: (row) => {
      queryClient.setQueryData(onlineKeys.game(gameId), row)
      patchHubLists(queryClient, row)
    },
    onError: (error, { moveIndex }) => {
      void settleFailedMove(error, moveIndex + 1)
    },
  })

  const resignGame = useMutation({
    ...resignGameMutationOptions,
    mutationKey: onlineKeys.write(gameId),
    onSuccess: (row) => {
      queryClient.setQueryData(onlineKeys.game(gameId), row)
      patchHubLists(queryClient, row)
    },
  })

  const viewingHistory =
    state.currentMoveIndex < state.moveHistory.length - 1

  //read off the shown ply and the store alone: the row arriving ahead of its
  //plies cannot open the board early, and a move of ours waiting on the server
  //keeps it shut until it is confirmed or refused
  const interactive =
    shown !== null &&
    mySeat !== null &&
    !state.gameOver &&
    state.currentTurn === mySeat &&
    !viewingHistory &&
    board.optimistic === null &&
    !board.animating

  const executeMove = useCallback(
    (selected: CellName[], destination: CellName) => {
      const current = stateRef.current
      //an illegal move never leaves the device. the server would refuse it
      //too, and a round trip to be told so is a round trip for nothing.
      if (!makeMove(current, selected, destination).result) return

      const moveIndex = store.getSnapshot().shown?.index
      if (moveIndex === undefined) return
      if (!store.play({ marbles: selected, destination })) return

      //the tap that played this is the only moment a browser will let the
      //audio device be woken, and it has to be taken before anything awaits
      primeSounds()
      setHovered(null)
      setViewIndex(null)

      play.mutate({ gameId, marbles: selected, destination, moveIndex })
    },
    [gameId, play.mutate, store],
  )

  const setHoveredCell = useCallback(
    (pos: CellName | null) => setHovered(pos),
    [],
  )

  const handleCellClick = useCallback(
    (pos: CellName) => {
      const current = stateRef.current
      if (!interactive) return

      const moveTo = getPossibleMoves(
        current,
        current.selectedMarbles,
        isBlackTurn(current),
      )
      if (moveTo.includes(pos)) {
        executeMove([...current.selectedMarbles], pos)
        return
      }

      const color = getMarbleAt(current, pos)
      if (!color) {
        setSelection(null)
        return
      }
      if (!isValidSelection(current, pos)) return

      setSelection({
        at: shownIndex,
        cells: current.selectedMarbles.includes(pos)
          ? deselectMarble(current.selectedMarbles, pos)
          : selectMarble(current, current.selectedMarbles, pos, color),
      })
      setHovered(null)
    },
    [executeMove, interactive, shownIndex],
  )

  const handleDragSelect = useCallback(
    (anchor: CellName, pos: CellName) => {
      const current = stateRef.current
      if (!interactive) return 0
      if (!isValidSelection(current, anchor)) return 0

      const run = selectRun(current, anchor, pos)
      if (!run) return 0

      const same =
        current.selectedMarbles.length === run.length &&
        run.every((cell, index) => current.selectedMarbles[index] === cell)
      if (!same) setSelection({ at: shownIndex, cells: run })
      return run.length
    },
    [interactive, shownIndex],
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
      setSelection(null)
      setHovered(null)
      //stepping through the game is opting out of watching the move that is
      //arriving: it lands at once instead
      boardRef.current?.stopAnimation()
      setViewIndex(index >= latestIndex ? null : Math.max(0, index))
    },
    [boardRef, latestIndex],
  )

  const failure = board.refusal ?? resignGame.error ?? gameQuery.error

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
    resign: (onSettled) => resignGame.mutate(gameId, { onSettled }),
  }
}
