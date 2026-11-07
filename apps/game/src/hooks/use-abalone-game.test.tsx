import type { GameMode } from "@repo/abalone-engine/game-state"
import { createGameState } from "@repo/abalone-engine/game-state"
import type { CellName } from "@repo/abalone-engine/types"
import { act } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { GameCanvasHandle } from "@/components/game-canvas"
import { useAbaloneGame } from "@/hooks/use-abalone-game"
import { TIMING } from "@/render/motion"
import { firstMoveOf } from "@/test-support/legal-move"
import { stubMemoryStorage } from "@/test-support/memory-storage"
import { renderHook } from "@/test-support/render-hook"

//what the hook owns is the game: whose turn it is, what a tap does, what the
//bot answers and how a game ends. everything it talks to is replaced by a stand
//in, so a test reads like a game rather than like a wiring diagram.

const world = vi.hoisted(() => ({
  /** What the bot answers with, asked for the position it is handed. */
  botAnswer: null as null | (() => { selection: string[]; move: string }),
  /** A position to start the next game from, instead of the opening. */
  openingOverride: null as null | Record<string, unknown>,
  /** The two display preferences a test turns on. */
  animations: false,
  autoRotate: false,
}))

vi.mock("@/ai/bot-client", () => ({
  BotClient: class {
    connect = vi.fn(async () => undefined)
    disconnect = vi.fn()
    requestMove = vi.fn(async () => world.botAnswer?.())
  },
}))

vi.mock("@/data/game-events/report", () => ({ reportGameEvent: vi.fn() }))
vi.mock("@/utils/sound", () => ({
  playFallSound: vi.fn(),
  playMoveSound: vi.fn(),
  primeSounds: vi.fn(),
}))
vi.mock("@/hooks/use-beside-board", () => ({ isBesideBoard: () => false }))
vi.mock("@/utils/landing-entry", () => ({ landedEntry: () => "home" }))
vi.mock("@/hooks/use-marble-design", () => ({
  useMarbleDesign: () => ["classic"],
}))
vi.mock("@/hooks/use-app-preferences", () => ({
  useAnimationsEnabled: () => [world.animations],
  useAutoRotateBoard: () => [world.autoRotate],
  useShowBoardLabels: () => [true],
  useShowEvalBar: () => [false],
}))

//the opening a test asks for is the one the next new game gets, which is how a
//position five captures into a game is reached without playing the game
vi.mock("@repo/abalone-engine/game-state", async (importOriginal) => {
  const engine =
    await importOriginal<
      typeof import("@repo/abalone-engine/game-state")
    >()
  return {
    ...engine,
    createGameState: (
      ...args: Parameters<typeof engine.createGameState>
    ) => ({
      ...engine.createGameState(...args),
      ...world.openingOverride,
    }),
  }
})

const { reportGameEvent } = await import("@/data/game-events/report")

const noModeChange = () => undefined

//a screen that is still mounted keeps listening for the tab closing, and would
//report its game as abandoned in the middle of the next test
const mounted: { unmount: () => void }[] = []

function mount(
  mode: "ai" | "local",
  options: {
    startOnBoard?: boolean
    board?: GameCanvasHandle
    onModeChange?: (mode: GameMode) => void
  } = {},
) {
  //one ref for the life of the screen, as a real one is: a new object each
  //render would rebuild every callback that depends on it
  const boardRef = { current: options.board ?? null }
  const game = renderHook(() =>
    useAbaloneGame(
      boardRef,
      mode,
      options.onModeChange ?? noModeChange,
      options.startOnBoard,
    ),
  )
  mounted.push(game)
  return game
}

/** Presses play, the way the setup panel does. */
async function startGame(
  game: ReturnType<typeof mount>,
  options: Parameters<
    ReturnType<typeof mount>["current"]["startNewGame"]
  >[0],
) {
  await act(async () => {
    await game.current.startNewGame(options)
  })
}

async function tap(game: ReturnType<typeof mount>, ...cells: CellName[]) {
  for (const cell of cells) {
    await act(async () => {
      await game.current.handleCellClick(cell)
    })
  }
}

/** Lets the bot's pause pass and its answer land. */
async function letBotReply() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(TIMING.BOT_REPLY + 1)
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  stubMemoryStorage()
  world.botAnswer = null
  world.openingOverride = null
  world.animations = false
  world.autoRotate = false
  vi.mocked(reportGameEvent).mockClear()
})

afterEach(() => {
  for (const game of mounted.splice(0)) game.unmount()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe("a game played on one device", () => {
  it("starts on the setup screen with nothing played", () => {
    const game = mount("local")

    expect(game.current.phase).toBe("pregame")
    expect(game.current.state.moveHistory).toHaveLength(1)
    expect(game.current.canUndo).toBe(false)
  })

  it("hands the turn over after a legal move", async () => {
    const game = mount("local")
    await startGame(game, {})
    const { selection, move } = firstMoveOf(game.current.state, "black")

    await tap(game, ...selection, move)

    expect(game.current.phase).toBe("ingame")
    expect(game.current.state.currentTurn).toBe("white")
    expect(game.current.state.moveHistory).toHaveLength(2)
    expect(game.current.state.black.has(move)).toBe(true)
  })

  it("turns down a move that is not on offer", async () => {
    const game = mount("local")
    await startGame(game, {})
    const { selection } = firstMoveOf(game.current.state, "black")

    //the middle of the board is nowhere a single marble on the front row reaches
    await tap(game, ...selection, "0,0")

    expect(game.current.state.currentTurn).toBe("black")
    expect(game.current.state.moveHistory).toHaveLength(1)
    expect(game.current.state.selectedMarbles).toEqual([])
  })

  it("does not pick up the marble of the side that is waiting", async () => {
    const game = mount("local")
    await startGame(game, {})
    const [whiteMarble] = [...game.current.state.white]

    await tap(game, whiteMarble)

    expect(game.current.state.selectedMarbles).toEqual([])
  })

  it("lets a tap on a picked-up marble put it back down", async () => {
    const game = mount("local")
    await startGame(game, {})
    const { selection } = firstMoveOf(game.current.state, "black")

    await tap(game, ...selection)
    expect(game.current.state.selectedMarbles).toEqual(selection)

    await tap(game, ...selection)
    expect(game.current.state.selectedMarbles).toEqual([])
  })

  it("picks up a run of marbles by dragging along it", async () => {
    const game = mount("local")
    await startGame(game, {})
    //two black marbles side by side on the front row
    const [anchor, neighbour] = ["2,-1", "2,0"]
    expect(game.current.state.black.has(anchor)).toBe(true)
    expect(game.current.state.black.has(neighbour)).toBe(true)

    let picked = 0
    act(() => {
      picked = game.current.handleDragSelect(anchor, neighbour)
    })

    expect(picked).toBe(2)
    expect(game.current.state.selectedMarbles).toEqual([anchor, neighbour])
  })

  it("takes the last move back, and only that one", async () => {
    const game = mount("local")
    await startGame(game, {})
    const first = firstMoveOf(game.current.state, "black")
    await tap(game, ...first.selection, first.move)
    const second = firstMoveOf(game.current.state, "white")
    await tap(game, ...second.selection, second.move)
    expect(game.current.canUndo).toBe(true)

    act(() => game.current.undoMove())

    expect(game.current.state.moveHistory).toHaveLength(2)
    expect(game.current.state.currentTurn).toBe("white")
  })

  it("has nothing to take back before the first move", async () => {
    const game = mount("local")
    await startGame(game, {})

    act(() => game.current.undoMove())

    expect(game.current.canUndo).toBe(false)
    expect(game.current.state.moveHistory).toHaveLength(1)
  })

  it("steps back through the moves and returns to the live one", async () => {
    const game = mount("local")
    await startGame(game, {})
    const first = firstMoveOf(game.current.state, "black")
    await tap(game, ...first.selection, first.move)

    act(() => game.current.goPrevMove())
    expect(game.current.viewingHistory).toBe(true)
    expect(game.current.canNext).toBe(true)

    //a rewound board takes no move: no branching off the past
    const before = game.current.state
    await tap(game, ...firstMoveOf(before, "black").selection)
    expect(game.current.state.selectedMarbles).toEqual([])

    act(() => game.current.goToLatestMove())
    expect(game.current.viewingHistory).toBe(false)
  })

  it("ends on the sixth marble pushed off, and counts the game once", async () => {
    //black two in a row on row 0 with a lone white marble on the rim ahead,
    //one push-off away from six
    world.openingOverride = {
      black: new Set(["0,2", "0,3"]),
      white: new Set(["0,4", "-4,0"]),
      blackScore: 5,
    }
    const game = mount("local")
    await startGame(game, {})

    await tap(game, "0,3", "0,2", "0,4")

    expect(game.current.state.blackScore).toBe(6)
    expect(game.current.state.gameOver).toBe(true)
    expect(game.current.state.winner).toBe("black")
    expect(game.current.phase).toBe("postgame")
    expect(game.current.gameOverModalOpen).toBe(true)

    const finishes = vi
      .mocked(reportGameEvent)
      .mock.calls.filter(([event]) => event.kind === "finish")
    expect(finishes).toHaveLength(1)
    expect(finishes[0][0]).toMatchObject({
      mode: "local",
      result: "black",
    })
  })

  it("lets nobody move once the game is over", async () => {
    const game = mount("local")
    await startGame(game, {})
    act(() => game.current.handleResign())

    const moves = firstMoveOf(game.current.state, "black")
    await tap(game, ...moves.selection, moves.move)

    expect(game.current.state.gameOver).toBe(true)
    expect(game.current.state.moveHistory).toHaveLength(1)
  })

  it("ends in the loser's name when the side to move resigns", async () => {
    const game = mount("local")
    await startGame(game, {})

    act(() => game.current.handleResign())

    expect(game.current.state.winner).toBe("white")
    expect(game.current.state.gameOverReason).toBe("resignation")
    expect(game.current.phase).toBe("postgame")
  })

  it("calls leaving a game before the end abandoning it", async () => {
    const game = mount("local")
    await startGame(game, {})

    game.unmount()

    const finishes = vi
      .mocked(reportGameEvent)
      .mock.calls.filter(([event]) => event.kind === "finish")
    expect(finishes).toHaveLength(1)
    expect(finishes[0][0]).toMatchObject({ result: "abandoned" })
  })

  it("keeps the names the players typed to twenty characters", () => {
    const game = mount("local")

    act(() => game.current.setLocalName("black", "x".repeat(40)))

    expect(game.current.localNames.black).toHaveLength(20)
  })
})

describe("a game on the board it was asked to start on", () => {
  it("is in play on the first render and counted once the timer has run", async () => {
    const game = mount("local", { startOnBoard: true })
    expect(game.current.phase).toBe("ingame")

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })

    const starts = vi
      .mocked(reportGameEvent)
      .mock.calls.filter(([event]) => event.kind === "start")
    expect(starts).toHaveLength(1)
    expect(starts[0][0]).toMatchObject({ mode: "local", guided: false })
  })

  it("plays a rematch on the colour that was played", async () => {
    const game = mount("local")
    await startGame(game, { setupType: "belgian_daisy" })
    const { selection, move } = firstMoveOf(game.current.state, "black")
    await tap(game, ...selection, move)

    await act(async () => {
      await game.current.handleRematch()
    })

    expect(game.current.state.moveHistory).toHaveLength(1)
    expect(game.current.state.setupType).toBe("belgian_daisy")
    expect(game.current.phase).toBe("ingame")
    const abandoned = vi
      .mocked(reportGameEvent)
      .mock.calls.filter(([event]) => event.kind === "finish")
    expect(abandoned).toHaveLength(1)
    expect(abandoned[0][0]).toMatchObject({
      result: "abandoned",
      moveCount: 1,
    })
  })

  it("goes back to the setup screen without starting a game", async () => {
    const game = mount("ai")
    await startGame(game, {})

    await act(async () => {
      await game.current.handleNewBot()
    })

    expect(game.current.phase).toBe("pregame")
    expect(game.current.gameDurationSeconds()).toBe(0)
  })

  it("tells how long the game has run", async () => {
    const game = mount("local")
    await startGame(game, {})

    await act(async () => {
      await vi.advanceTimersByTimeAsync(65_000)
    })

    expect(game.current.gameDurationSeconds()).toBe(65)
  })

  it("asks to change the mode when a game is started in the other one", async () => {
    const onModeChange = vi.fn()
    const game = mount("ai", { onModeChange })

    await startGame(game, { mode: "local" })

    expect(onModeChange).toHaveBeenCalledWith("local")
    expect(game.current.playerColor).toBe("black")
  })

  it("follows the mode switch on the setup screen", () => {
    const onModeChange = vi.fn()
    const game = mount("ai", { onModeChange })
    act(() => game.current.chooseColor("white"))

    act(() => game.current.chooseMode("local"))

    expect(onModeChange).toHaveBeenCalledWith("local")
    //hot-seat play always starts from black's side
    expect(game.current.playerColor).toBe("black")
    expect(game.current.state.mode).toBe("local")
  })

  it("counts a game left by closing the tab as abandoned", async () => {
    const game = mount("ai")
    await startGame(game, {})

    window.dispatchEvent(new Event("pagehide"))

    const finishes = vi
      .mocked(reportGameEvent)
      .mock.calls.filter(([event]) => event.kind === "finish")
    expect(finishes[0][0]).toMatchObject({
      mode: "ai",
      result: "abandoned",
    })
    game.unmount()
    expect(
      vi
        .mocked(reportGameEvent)
        .mock.calls.filter(([e]) => e.kind === "finish"),
    ).toHaveLength(1)
  })

  it("records a resignation against the computer as a loss", async () => {
    const game = mount("ai")
    await startGame(game, { colorChoice: "black" })

    act(() => game.current.handleResign())

    const finishes = vi
      .mocked(reportGameEvent)
      .mock.calls.filter(([event]) => event.kind === "finish")
    expect(finishes).toHaveLength(1)
    expect(finishes[0][0]).toMatchObject({ mode: "ai", result: "loss" })
  })

  it("follows the pointer across the board", async () => {
    const game = mount("local")
    await startGame(game, {})

    act(() => game.current.setHoveredCell("0,0"))
    expect(game.current.state.hoveredCell).toBe("0,0")
    act(() => game.current.setHoveredCell(null))
    expect(game.current.state.hoveredCell).toBeNull()
  })
})

describe("a move with the animations on", () => {
  it("waits for the marbles to land before the move counts", async () => {
    world.animations = true
    let land: () => void = () => undefined
    const animateMove = vi.fn(
      () => new Promise<void>((resolve) => (land = resolve)),
    )
    const game = mount("local", {
      board: { animateMove } as unknown as GameCanvasHandle,
    })
    await startGame(game, {})
    const { selection, move } = firstMoveOf(game.current.state, "black")
    await tap(game, ...selection)

    let played: Promise<void> = Promise.resolve()
    act(() => {
      played = game.current.handleCellClick(move)
    })
    expect(animateMove).toHaveBeenCalledOnce()
    expect(game.current.state.moveHistory).toHaveLength(1)

    //nothing else may be played while the marbles are in the air
    await tap(game, ...firstMoveOf(game.current.state, "black").selection)
    expect(game.current.state.selectedMarbles).toEqual(selection)

    await act(async () => {
      land()
      await played
    })
    expect(game.current.state.moveHistory).toHaveLength(2)
  })
})

describe("a hot-seat board that turns with the player", () => {
  it("turns around after the move, and holds still while the game is read back", async () => {
    world.autoRotate = true
    const game = mount("local")
    await startGame(game, {})
    expect(game.current.state.shouldFlipBoard).toBe(false)

    const first = firstMoveOf(game.current.state, "black")
    await tap(game, ...first.selection, first.move)
    //the player who just moved gets to see the result first
    expect(game.current.state.shouldFlipBoard).toBe(false)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(TIMING.BOARD_FLIP + 1)
    })
    expect(game.current.state.shouldFlipBoard).toBe(true)

    act(() => game.current.goPrevMove())
    expect(game.current.state.shouldFlipBoard).toBe(true)

    //coming back to the live position lands at once
    act(() => game.current.goToLatestMove())
    expect(game.current.state.shouldFlipBoard).toBe(true)
  })
})

describe("a game against the computer", () => {
  it("applies the bot's reply to the board", async () => {
    const game = mount("ai")
    world.botAnswer = () => firstMoveOf(game.current.state, "white")
    await startGame(game, { colorChoice: "black" })
    const { selection, move } = firstMoveOf(game.current.state, "black")

    await tap(game, ...selection, move)
    expect(game.current.state.currentTurn).toBe("white")
    expect(game.current.aiThinking).toBe(true)
    await letBotReply()

    expect(game.current.state.moveHistory).toHaveLength(3)
    expect(game.current.state.currentTurn).toBe("black")
    expect(game.current.aiThinking).toBe(false)
  })

  it("plays first when the player took white", async () => {
    const game = mount("ai")
    world.botAnswer = () => firstMoveOf(game.current.state, "black")
    await startGame(game, { colorChoice: "white" })

    await letBotReply()

    expect(game.current.aiColor).toBe("black")
    expect(game.current.state.moveHistory).toHaveLength(2)
    expect(game.current.state.currentTurn).toBe("white")
  })

  it("ignores a bot reply that is not a legal move", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {})
    const game = mount("ai")
    world.botAnswer = () => ({ selection: ["-2,0"], move: "0,0" })
    await startGame(game, { colorChoice: "white" })

    await letBotReply()

    expect(game.current.state.moveHistory).toHaveLength(1)
    expect(game.current.aiThinking).toBe(false)
    expect(errors).toHaveBeenCalledWith(
      "Invalid AI move",
      expect.anything(),
    )
    errors.mockRestore()
  })

  it("takes back the player's move together with the bot's reply", async () => {
    const game = mount("ai")
    world.botAnswer = () => firstMoveOf(game.current.state, "white")
    await startGame(game, { colorChoice: "black" })
    const { selection, move } = firstMoveOf(game.current.state, "black")
    await tap(game, ...selection, move)
    await letBotReply()
    expect(game.current.state.moveHistory).toHaveLength(3)

    act(() => game.current.undoMove())

    expect(game.current.state.moveHistory).toHaveLength(1)
    expect(game.current.state.currentTurn).toBe("black")
  })

  it("offers a hint only on the player's own turn", async () => {
    const game = mount("ai")
    world.botAnswer = () => firstMoveOf(game.current.state, "white")
    await startGame(game, { colorChoice: "black" })
    expect(game.current.canHint).toBe(true)

    const { selection, move } = firstMoveOf(game.current.state, "black")
    await tap(game, ...selection, move)

    expect(game.current.canHint).toBe(false)
  })

  it("shows the hint as a picked-up marble and a target", async () => {
    const game = mount("ai")
    const hint = firstMoveOf(
      createGameState("standard", "black", "ai"),
      "black",
    )
    world.botAnswer = () => hint
    await startGame(game, { colorChoice: "black" })

    await act(async () => {
      await game.current.requestHint()
    })

    expect(game.current.state.selectedMarbles).toEqual(hint.selection)
    expect(game.current.state.hoveredCell).toBe(hint.move)
  })
})

describe("the setup screen", () => {
  it("previews the layout and colour that were picked", () => {
    const game = mount("ai")

    act(() => game.current.chooseSetup("belgian_daisy"))
    act(() => game.current.chooseColor("white"))

    expect(game.current.setupType).toBe("belgian_daisy")
    expect(game.current.playerColor).toBe("white")
    expect(game.current.state.setupType).toBe("belgian_daisy")
    expect(game.current.state.playerColor).toBe("white")
  })

  it("does not spend the coin flip on a preview", () => {
    const game = mount("ai")

    act(() => game.current.chooseColor("random"))

    expect(game.current.colorChoice).toBe("random")
    expect(game.current.playerColor).toBe("black")
  })
})
