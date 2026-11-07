import type { GameState } from "@repo/abalone-engine/game-state"
import { createGameState, makeMove } from "@repo/abalone-engine/game-state"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { act, createElement } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { MoveRefusedError } from "@/data/online/mutations"
import type { Game, GameMove } from "@/data/online/queries"
import { onlineKeys } from "@/data/online/queries"
import { toGameState, useOnlineGame } from "@/hooks/use-online-game"
import { firstMoveOf } from "@/test-support/legal-move"
import { stubMemoryStorage } from "@/test-support/memory-storage"
import { renderHook } from "@/test-support/render-hook"

//the server, as far as the hook can tell: what the two reads answer with and
//what a move or a resignation gets back. the hook, the store behind it and the
//query cache are all real, so a test follows a move the way the board does.
const server = vi.hoisted(() => ({
  row: null as unknown,
  plies: [] as unknown[],
  playMove: null as null | ((input: unknown) => Promise<unknown>),
  resign: null as null | (() => Promise<unknown>),
}))

vi.mock("@/data/online/queries", async (importOriginal) => {
  const real =
    await importOriginal<typeof import("@/data/online/queries")>()
  const { queryOptions } = await import("@tanstack/react-query")
  return {
    ...real,
    gameQueryOptions: (gameId: string) =>
      queryOptions({
        queryKey: real.onlineKeys.game(gameId),
        queryFn: async () => server.row as Game,
      }),
    gameMovesQueryOptions: (gameId: string) =>
      queryOptions({
        queryKey: real.onlineKeys.moves(gameId),
        staleTime: Number.POSITIVE_INFINITY,
        queryFn: async () => server.plies as GameMove[],
      }),
  }
})

vi.mock("@/data/online/mutations", async (importOriginal) => {
  const real =
    await importOriginal<typeof import("@/data/online/mutations")>()
  return {
    ...real,
    playMoveMutationOptions: {
      mutationFn: async (input: unknown) => server.playMove?.(input),
    },
    resignGameMutationOptions: {
      mutationFn: async () => server.resign?.(),
    },
  }
})

vi.mock("@/providers/auth-provider", () => ({
  useAuth: () => ({ user: { id: "me" } }),
}))
//the channel is up, so the row is not polled: a test moves the server on by hand
vi.mock("@/providers/realtime-provider", () => ({
  useRealtime: () => ({ isConnected: true }),
}))
vi.mock("@/hooks/use-api-error", () => ({
  useApiError: () => (error: unknown) => (error as Error).message,
}))
vi.mock("@/hooks/use-app-preferences", () => ({
  useAnimationsEnabled: () => [false],
}))
vi.mock("@/utils/sound", () => ({
  playFallSound: vi.fn(),
  playMoveSound: vi.fn(),
  primeSounds: vi.fn(),
}))

//the board reads a game off two requests that arrive separately: the row, which
//is cheap and polled, and the plies, which are not. these are about the window
//between them, where the row already knows something the board cannot draw yet.

/** Only the fields `toGameState` actually reads. */
function row(overrides: Partial<Game>): Game {
  return {
    id: "3f7b1c60-0000-4000-8000-000000000001",
    setupType: "standard",
    status: "active",
    moveCount: 0,
    winner: null,
    finishReason: null,
    ...overrides,
  } as Game
}

/** The opening, which nobody moved into. */
const opening = {
  blackCells: ["-4,0", "-4,1"],
  whiteCells: ["4,-1", "4,0"],
  blackScore: 0,
  whiteScore: 0,
  currentTurn: "black",
  marbles: null,
  destination: null,
  direction: null,
  isPush: false,
  isCapture: false,
  shovedMarbles: [],
} as unknown as GameMove

/** One ply on from it, which black played. */
const ply = {
  blackCells: ["-3,0", "-4,1"],
  whiteCells: ["4,-1", "4,0"],
  blackScore: 0,
  whiteScore: 6,
  currentTurn: "white",
  marbles: ["-4,0"],
  destination: "-3,0",
  direction: { r: 1, q: 0 },
  isPush: false,
  isCapture: true,
  shovedMarbles: [],
} as unknown as GameMove

describe("toGameState", () => {
  //THE REGRESSION. the row is a round trip ahead of the plies, so a game the
  //opponent has just won reads as finished while the board is still showing the
  //position before the winning move. Believed then, the result goes up over that
  //position, comes down when the plies arrive and the move plays out, and goes
  //back up after it — the panel swapping to its postgame form and back, and the
  //modal blinking, over a board that has not moved.
  it("holds back an ending the move history has not reached", () => {
    const state = toGameState(
      row({ status: "finished", moveCount: 1, winner: "black" }),
      [opening],
      "black",
      null,
    )

    expect(state.gameOver).toBe(false)
    expect(state.winner).toBeNull()
    expect(state.gameOverReason).toBeNull()
  })

  it("reports the ending once the plies have caught up", () => {
    const state = toGameState(
      row({
        status: "finished",
        moveCount: 1,
        winner: "black",
        finishReason: "score",
      }),
      [opening, ply],
      "black",
      null,
    )

    expect(state.gameOver).toBe(true)
    expect(state.winner).toBe("black")
    expect(state.gameOverReason).toBe("score")
  })

  //a resignation ends a game without adding a ply, so the count on the row is
  //the one the history already holds. gating on the count rather than on the
  //status is what keeps this immediate while the other case waits.
  it("reports a resignation, which adds no move", () => {
    const state = toGameState(
      row({
        status: "finished",
        moveCount: 0,
        winner: "white",
        finishReason: "resignation",
      }),
      [opening],
      "black",
      null,
    )

    expect(state.gameOver).toBe(true)
    expect(state.winner).toBe("white")
  })

  it("leaves a game in progress alone", () => {
    const state = toGameState(
      row({ moveCount: 1 }),
      [opening, ply],
      "black",
      null,
    )

    expect(state.gameOver).toBe(false)
    expect(state.currentTurn).toBe("white")
    expect(state.currentMoveIndex).toBe(1)
  })
})

const GAME_ID = "3f7b1c60-0000-4000-8000-000000000001"

/** The log a game's history makes on the server: one stored ply per entry. */
function pliesOf(state: GameState): GameMove[] {
  return state.moveHistory.map((entry) => ({
    blackCells: entry.black,
    whiteCells: entry.white,
    blackScore: entry.blackScore,
    whiteScore: entry.whiteScore,
    currentTurn: entry.currentTurn,
    marbles: entry.moveDetails?.marbles ?? null,
    destination: entry.moveDetails?.destination ?? null,
    direction: entry.moveDetails?.direction ?? null,
    isPush: entry.moveDetails?.isPush ?? false,
    isCapture: entry.moveDetails?.isCapture ?? false,
    shovedMarbles: entry.moveDetails?.shovedMarbles ?? [],
  })) as unknown as GameMove[]
}

/** A game I play as black against somebody else, `moveCount` plies in. */
function myGame(overrides: Partial<Game> = {}): Game {
  return {
    id: GAME_ID,
    setupType: "standard",
    status: "active",
    currentTurn: "black",
    moveCount: 0,
    winner: null,
    finishReason: null,
    black: { userId: "me" },
    white: { userId: "them" },
    ...overrides,
  } as unknown as Game
}

/** Waits for work the hook does on its own: queries landing, the store stepping. */
async function settle() {
  for (let round = 0; round < 8; round++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve))
    })
  }
}

const mounted: { unmount: () => void }[] = []

function mountOnline() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const boardRef = { current: null }
  const hook = renderHook(
    () => useOnlineGame(GAME_ID, boardRef),
    ({ children }: { children: ReactNode }) =>
      createElement(
        QueryClientProvider,
        { client: queryClient },
        children,
      ),
  )
  mounted.push(hook)
  return { hook, queryClient }
}

/** Taps cells one at a time, each on the render the last one produced. */
async function tap(
  hook: ReturnType<typeof mountOnline>["hook"],
  ...cells: string[]
) {
  for (const cell of cells) {
    await act(async () => hook.current.handleCellClick(cell))
  }
}

/** Plays black's first move on a copy of the opening, as the server stores it. */
function blackOpens() {
  const opening = createGameState("standard", "black", "online")
  const { selection, move } = firstMoveOf(opening, "black")
  const after = makeMove(opening, selection, move).state
  return { opening, selection, move, after }
}

describe("useOnlineGame", () => {
  beforeEach(() => {
    stubMemoryStorage()
    const opening = createGameState("standard", "black", "online")
    server.row = myGame()
    server.plies = pliesOf(opening)
    server.playMove = null
    server.resign = null
  })

  afterEach(() => {
    for (const hook of mounted.splice(0)) hook.unmount()
    vi.unstubAllGlobals()
  })

  it("is loading until the row and the plies have both arrived", async () => {
    const { hook } = mountOnline()
    expect(hook.current.isLoading).toBe(true)

    await settle()

    expect(hook.current.isLoading).toBe(false)
    expect(hook.current.mySeat).toBe("black")
    expect(hook.current.state.moveHistory).toHaveLength(1)
  })

  it("opens the board to the side to move", async () => {
    const { hook } = mountOnline()
    await settle()

    expect(hook.current.interactive).toBe(true)
  })

  it("keeps the board shut while it is the opponent's move", async () => {
    const { opening, selection, move } = blackOpens()
    server.row = myGame({ currentTurn: "white", moveCount: 1 })
    server.plies = pliesOf(makeMove(opening, selection, move).state)
    const { hook } = mountOnline()
    await settle()

    expect(hook.current.state.currentTurn).toBe("white")
    expect(hook.current.interactive).toBe(false)
  })

  it("lets somebody who is not in the game watch and nothing else", async () => {
    server.row = myGame({
      black: { userId: "x" },
      white: { userId: "y" },
    } as Partial<Game>)
    const { hook } = mountOnline()
    await settle()

    expect(hook.current.mySeat).toBeNull()
    expect(hook.current.interactive).toBe(false)
  })

  it("plays a legal move at once and holds the board until the server has it", async () => {
    const { selection, move, after } = blackOpens()
    const sent = vi.fn(async () => {
      //the server stores the ply and says where the game stands now
      server.row = myGame({ currentTurn: "white", moveCount: 1 })
      server.plies = pliesOf(after)
      return server.row
    })
    server.playMove = sent
    const { hook } = mountOnline()
    await settle()

    await tap(hook, ...selection, move)

    expect(sent).toHaveBeenCalledWith({
      gameId: GAME_ID,
      marbles: selection,
      destination: move,
      moveIndex: 0,
    })
    expect(hook.current.state.currentTurn).toBe("white")
    expect(hook.current.state.black.has(move)).toBe(true)

    await settle()

    expect(hook.current.state.moveHistory).toHaveLength(2)
    expect(hook.current.interactive).toBe(false)
    expect(hook.current.error).toBeUndefined()
  })

  it("never sends a move the rules do not allow", async () => {
    const sent = vi.fn()
    server.playMove = sent
    const { hook } = mountOnline()
    await settle()
    const { selection } = firstMoveOf(hook.current.state, "black")

    await tap(hook, selection[0], "0,0")
    await settle()

    expect(sent).not.toHaveBeenCalled()
    expect(hook.current.state.moveHistory).toHaveLength(1)
  })

  it("rolls the board back when the server refuses the move", async () => {
    const { selection, move } = blackOpens()
    server.playMove = async () => {
      throw new MoveRefusedError("That move is no longer open.")
    }
    const { hook } = mountOnline()
    await settle()

    await tap(hook, ...selection, move)
    await settle()

    expect(hook.current.state.currentTurn).toBe("black")
    expect(hook.current.state.black.has(move)).toBe(false)
    expect(hook.current.state.black.has(selection[0])).toBe(true)
    expect(hook.current.error).toBe("That move is no longer open.")
    expect(hook.current.interactive).toBe(true)
  })

  it("rolls the board back when a failed request never reached the log", async () => {
    const { selection, move } = blackOpens()
    const sent = vi.fn(async () => {
      throw new Error("Failed to fetch")
    })
    server.playMove = sent
    const { hook } = mountOnline()
    await settle()

    await tap(hook, ...selection, move)
    //the log is asked again before the silence counts as a refusal
    await settle()

    expect(sent).toHaveBeenCalledOnce()
    expect(hook.current.state.currentTurn).toBe("black")
    expect(hook.current.state.black.has(move)).toBe(false)
    expect(hook.current.interactive).toBe(true)
  })

  it("keeps a move whose answer was lost after the server stored it", async () => {
    const { selection, move, after } = blackOpens()
    server.playMove = async () => {
      server.row = myGame({ currentTurn: "white", moveCount: 1 })
      server.plies = pliesOf(after)
      throw new Error("Failed to fetch")
    }
    const { hook } = mountOnline()
    await settle()

    await tap(hook, ...selection, move)
    await settle()

    expect(hook.current.state.moveHistory).toHaveLength(2)
    expect(hook.current.state.black.has(move)).toBe(true)
    expect(hook.current.error).toBeUndefined()
  })

  it("shows a resignation as the end of the game and says when it is settled", async () => {
    server.resign = async () => {
      server.row = myGame({
        status: "finished",
        winner: "white",
        finishReason: "resignation",
      })
      return server.row
    }
    const settled = vi.fn()
    const { hook } = mountOnline()
    await settle()

    await act(async () => hook.current.resign(settled))
    await settle()

    expect(settled).toHaveBeenCalledOnce()
    expect(hook.current.state.gameOver).toBe(true)
    expect(hook.current.state.winner).toBe("white")
    expect(hook.current.interactive).toBe(false)
    expect(hook.current.isResigning).toBe(false)
  })

  it("marks both game lists stale once the game has ended", async () => {
    server.row = myGame({
      status: "finished",
      winner: "black",
      finishReason: "resignation",
    })
    const { hook, queryClient } = mountOnline()
    for (const status of ["active", "finished"] as const) {
      queryClient.setQueryData(onlineKeys.games(status), [])
    }
    await settle()

    for (const status of ["active", "finished"] as const) {
      expect(
        queryClient.getQueryState(onlineKeys.games(status))?.isInvalidated,
      ).toBe(true)
    }
    expect(hook.current.game?.status).toBe("finished")
  })

  it("reads the game back a ply at a time without moving the live board", async () => {
    const { after } = blackOpens()
    server.row = myGame({ currentTurn: "white", moveCount: 1 })
    server.plies = pliesOf(after)
    const { hook } = mountOnline()
    await settle()
    expect(hook.current.viewingHistory).toBe(false)

    await act(async () => hook.current.goPrevMove())
    expect(hook.current.viewingHistory).toBe(true)
    expect(hook.current.state.currentMoveIndex).toBe(0)
    expect(hook.current.canNext).toBe(true)
    expect(hook.current.interactive).toBe(false)

    await act(async () => hook.current.goToLatestMove())
    expect(hook.current.viewingHistory).toBe(false)
    expect(hook.current.state.currentMoveIndex).toBe(1)
  })

  it("picks up marbles by tapping and drags out a run", async () => {
    const { hook } = mountOnline()
    await settle()
    const { selection } = firstMoveOf(hook.current.state, "black")

    await act(async () => hook.current.handleCellClick(selection[0]))
    expect(hook.current.state.selectedMarbles).toEqual(selection)
    expect(hook.current.possibleMoves.length).toBeGreaterThan(0)

    await act(async () => hook.current.handleCellClick(selection[0]))
    expect(hook.current.state.selectedMarbles).toEqual([])

    let picked = 0
    await act(async () => {
      picked = hook.current.handleDragSelect("2,-1", "2,0")
    })
    expect(picked).toBe(2)
    expect(hook.current.state.selectedMarbles).toEqual(["2,-1", "2,0"])
  })
})
