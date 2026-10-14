import type { GameState } from "@repo/abalone-engine/game-state"
import { makeMove } from "@repo/abalone-engine/game-state"
import type { MoveOutcome } from "@repo/abalone-engine/rules"
import type { MoveAnimation } from "@/components/game-canvas"
import type { OptimisticPly, PlyMove } from "@/utils/board-timeline"
import { nextBoardStep } from "@/utils/board-timeline"

/**
 * The one owner of what the online board shows. See `docs/online-board.md`.
 *
 * Holds the shown ply and our own unconfirmed move, and runs the steps
 * `nextBoardStep` asks for, one at a time, until it says `idle`. Nothing else
 * writes either of them: a network answer only hands in a new log, and the
 * board only ever reads the snapshot.
 */

/** The ply on the board, and the position it draws. */
export type ShownPly = { index: number; state: GameState }

export type OnlineBoardSnapshot = {
  /** Null until the first log has arrived. */
  shown: ShownPly | null
  /** Our own move the server has not confirmed yet, or null. */
  optimistic: OptimisticPly | null
  /** A ply is sliding across the board. */
  animating: boolean
  /** Why our last move was refused, until the next one is played. */
  refusal: Error | null
}

/**
 * The server's log, taken from one snapshot of the plies: the last index, the
 * move behind each ply and the position a cut lands on never come from two
 * different fetches.
 */
export type OnlineBoardLog = {
  latest: number
  moveAt: (index: number) => PlyMove | undefined
  stateAt: (index: number) => GameState
}

/** What the store asks of the screen around it. */
export type OnlineBoardEffects = {
  /** False while the tab is hidden, animations are off or the game is being read back. */
  canAnimate: () => boolean
  /** Plays a move out on the canvas. Must always settle. */
  animate: (move: MoveAnimation) => Promise<void>
  /** Cuts the move in flight short, so `animate` settles now. */
  stopAnimation: () => void
  /** A ply has landed after being played out (sounds). */
  onPlayed: (outcome: MoveOutcome) => void
}

export class OnlineBoardStore {
  private snapshot: OnlineBoardSnapshot = {
    shown: null,
    optimistic: null,
    animating: false,
    refusal: null,
  }
  private readonly listeners = new Set<() => void>()
  private log: OnlineBoardLog | null = null
  private running = false
  private attached = false

  constructor(private readonly effects: OnlineBoardEffects) {}

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getSnapshot = () => this.snapshot

  /** The board is on screen: steps may run. */
  attach() {
    this.attached = true
    void this.run()
  }

  /** The board left the screen or moved to another game: stop, and settle the move in flight. */
  detach() {
    this.attached = false
    this.effects.stopAnimation()
  }

  /** A new copy of the server's log. */
  setLog(log: OnlineBoardLog) {
    this.log = log
    void this.run()
  }

  /**
   * Plays our own move from the ply on the board.
   *
   * @returns false when the board cannot take a move now: one of ours is still
   * waiting on the server, or a ply is being played out.
   */
  play(move: PlyMove): boolean {
    const { shown, optimistic } = this.snapshot
    if (!shown || optimistic || this.running) return false

    this.update({
      optimistic: { ...move, index: shown.index + 1 },
      refusal: null,
    })
    void this.run()
    return true
  }

  /** The server says our move at this index did not happen. */
  refuse(index: number, reason: Error) {
    const { optimistic } = this.snapshot
    if (!optimistic || optimistic.index !== index) return

    this.update({
      optimistic: { ...optimistic, refused: true },
      refusal: reason,
    })
    void this.run()
  }

  private update(patch: Partial<OnlineBoardSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch }
    for (const listener of this.listeners) listener()
  }

  /**
   * The apply loop. One at a time: a call while it runs returns at once, and
   * the running loop reads whatever changed on its next step.
   */
  private async run() {
    if (this.running) return
    this.running = true
    try {
      while (this.attached && this.log && this.log.latest >= 0) {
        const log = this.log
        const { shown, optimistic } = this.snapshot
        const step = nextBoardStep({
          shown: shown?.index ?? -1,
          serverLatest: log.latest,
          serverMove: log.moveAt,
          optimistic,
          canAnimate: this.effects.canAnimate(),
        })

        if (step.kind === "idle") return
        if (step.kind === "confirm") {
          //the same state object stays: nothing on screen changes
          this.update({ optimistic: null })
        } else if (step.kind === "cut") {
          this.cut(log, step.index)
        } else {
          await this.playOut(log, step.index, step.move)
        }
      }
    } finally {
      this.running = false
    }
  }

  private cut(log: OnlineBoardLog, index: number) {
    this.update({
      shown: { index, state: log.stateAt(index) },
      optimistic: null,
      animating: false,
    })
  }

  /** Plays one ply out from the shown position, then shows it. */
  private async playOut(
    log: OnlineBoardLog,
    index: number,
    move: PlyMove,
  ) {
    const shown = this.snapshot.shown
    const from = shown?.state
    const { state: next, result } = from
      ? makeMove(from, move.marbles, move.destination)
      : { state: null, result: null }

    //not a move from the position on the board: the log and the board
    //disagree, and the log is the authority
    if (!shown || !next || !result) {
      this.cut(log, log.latest)
      return
    }

    if (this.effects.canAnimate()) {
      //the last move's arrows go before the marbles set off, so what plays out
      //is this move rather than the one before it clearing up
      this.update({
        shown: {
          index: shown.index,
          state: { ...shown.state, lastMove: null },
        },
        animating: true,
      })
      await this.effects.animate({
        movingMarbles: result.movingMarbles,
        direction: result.direction,
      })
      if (!this.attached) {
        this.update({ animating: false })
        return
      }
      this.effects.onPlayed(result)
    } else if (this.snapshot.optimistic?.index === index) {
      //our own move with animations off still clicks into place
      this.effects.onPlayed(result)
    }

    this.update({ shown: { index, state: next }, animating: false })
  }
}
