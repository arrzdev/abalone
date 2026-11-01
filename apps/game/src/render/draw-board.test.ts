import type { GameState } from "@repo/abalone-engine/game-state"
import {
  createGameState,
  goToMove,
  makeMove,
} from "@repo/abalone-engine/game-state"
import type { CellName } from "@repo/abalone-engine/types"
import { describe, expect, it } from "vitest"
import type { BoardView } from "@/render/draw-board"
import { coordinateLabels, furrowsToShow } from "@/render/draw-board"
import { hexCenter } from "@/render/hex-grid"

//the furrow is laid out in board pixels, and none of that is what is under
//test — only which side the ink is chosen for. any sane view will do.
const VIEW: BoardView = {
  centerX: 200,
  centerY: 200,
  radius: 16,
  spacing: 40,
  baseLineWidth: 1,
  width: 400,
  height: 400,
}

/** Plays the first legal single-marble move the side to move has. */
function playOneMove(state: GameState) {
  const movers = state.currentTurn === "black" ? state.black : state.white
  for (const marble of movers) {
    const [r, q] = marble.split(",").map(Number)
    for (const [dr, dq] of [
      [1, 0],
      [1, -1],
      [0, -1],
      [-1, 0],
      [-1, 1],
      [0, 1],
    ]) {
      const destination = `${r + dr},${q + dq}` as CellName
      const attempt = makeMove(state, [marble], destination)
      if (attempt.result) return { played: attempt.state, marble }
    }
  }
  throw new Error("no legal move to test with")
}

describe("furrowsToShow", () => {
  //the regression. a settled furrow reads the mover's colour off the board,
  //and it has to read it where the mover now stands. an online board never
  //replays a move — it maps the server's log and settles through `goToMove` —
  //so a `goToMove` that reported the squares the movers LEFT put a black
  //marble's trail in white ink and a white one's in black, on every move the
  //opponent made. the animation reads the marble itself and was always right,
  //which is what made it look like the trail changed colour on landing.
  it("inks a settled furrow for the side that moved", () => {
    const start = createGameState("standard", "black", "local")
    const { played } = playOneMove(start)

    const settled = furrowsToShow(VIEW, played)
    expect(settled).toHaveLength(1)
    expect(settled[0].onDark).toBe(true)

    //the same position arrived at the way an online board arrives at it
    const mapped = goToMove(played, played.currentMoveIndex)
    const remapped = furrowsToShow(VIEW, mapped)
    expect(remapped).toHaveLength(1)
    expect(remapped[0].onDark).toBe(true)
  })

  it("inks white's furrow for white", () => {
    const start = createGameState("standard", "black", "local")
    const { played: afterBlack } = playOneMove(start)
    const { played } = playOneMove(afterBlack)

    const mapped = goToMove(played, played.currentMoveIndex)
    expect(furrowsToShow(VIEW, mapped)[0].onDark).toBe(false)
  })

  it("draws nothing before anyone has moved", () => {
    const start = createGameState("standard", "black", "local")
    expect(furrowsToShow(VIEW, start)).toEqual([])
  })
})

//the board as game-canvas lays it out: a 375-wide phone and an 800-wide desktop
const PHONE: BoardView = {
  centerX: 177,
  centerY: 155,
  radius: 17.7,
  spacing: 17.7 * 1.14,
  baseLineWidth: 1,
  width: 354,
  height: 310,
}
const DESKTOP: BoardView = {
  centerX: 400,
  centerY: 350,
  radius: 40,
  spacing: 40 * 1.14,
  baseLineWidth: 2,
  width: 800,
  height: 700,
}

/** Every square's centre, as the board paints it. */
function cellCentres(view: BoardView, flip: boolean) {
  const centres: { x: number; y: number }[] = []
  for (let q = -4; q <= 4; q++) {
    for (let r = Math.max(-4, -q - 4); r <= Math.min(4, -q + 4); r++) {
      centres.push(
        hexCenter(r, q, view.centerX, view.centerY, view.spacing, flip),
      )
    }
  }
  return centres
}

function labelAt(view: BoardView, flip: boolean, text: string) {
  const found = coordinateLabels(view, flip).find(
    (label) => label.text === text,
  )
  if (!found) throw new Error(`no label ${text}`)
  return found
}

describe("coordinateLabels", () => {
  it("names the nine rows a to i and the nine diagonals 1 to 9", () => {
    const texts = coordinateLabels(DESKTOP, false).map(
      (label) => label.text,
    )
    expect([...texts].sort()).toEqual(
      [..."abcdefghi", ..."123456789"].sort(),
    )
  })

  it("puts a beside the bottom row and 1 under it on a board the right way up", () => {
    const { centerX, centerY, spacing } = DESKTOP
    //row a is r = 4, its left-most square is q = -4
    const corner = hexCenter(4, -4, centerX, centerY, spacing)
    const a = labelAt(DESKTOP, false, "a")
    expect(a.y).toBeCloseTo(corner.y)
    expect(a.x).toBeLessThan(corner.x)
    const one = labelAt(DESKTOP, false, "1")
    expect(one.y).toBeGreaterThan(corner.y)
  })

  //the regression: the squares turned with the board and the labels did not,
  //so on a board flipped for white every letter named the wrong row
  it("keeps every label on its own row and diagonal when the board is flipped", () => {
    const { centerX, centerY, spacing } = DESKTOP
    const corner = hexCenter(4, -4, centerX, centerY, spacing, true)
    const a = labelAt(DESKTOP, true, "a")
    expect(a.y).toBeCloseTo(corner.y)
    expect(a.x).toBeGreaterThan(corner.x)
    //row a is at the top now, and the numbers run along the upper edge
    expect(a.y).toBeLessThan(centerY)
    expect(labelAt(DESKTOP, true, "1").y).toBeLessThan(corner.y)
    expect(labelAt(DESKTOP, true, "i").y).toBeGreaterThan(centerY)
  })

  for (const [name, view] of [
    ["phone", PHONE],
    ["desktop", DESKTOP],
  ] as const) {
    for (const flip of [false, true]) {
      it(`${name}${flip ? ", flipped" : ""}: no label reaches a marble`, () => {
        const marble = view.radius * 0.8
        for (const label of coordinateLabels(view, flip)) {
          for (const centre of cellCentres(view, flip)) {
            const distance = Math.hypot(
              label.x - centre.x,
              label.y - centre.y,
            )
            expect(distance).toBeGreaterThanOrEqual(
              marble + label.size / 2,
            )
          }
        }
      })
    }
  }

  it("never sets a label smaller than 10px, even on a phone", () => {
    for (const label of coordinateLabels(PHONE, false)) {
      expect(label.size).toBeGreaterThanOrEqual(10)
    }
    //and the desktop keeps the size it has always had
    expect(labelAt(DESKTOP, false, "a").size).toBeCloseTo(40 * 0.44)
  })
})
