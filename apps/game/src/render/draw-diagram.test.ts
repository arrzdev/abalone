import { beforeEach, describe, expect, it, vi } from "vitest"
import { diagramAspect, drawDiagram } from "@/render/draw-diagram"

//the marble painter is the board renderer's, and not what is under test: it is
//replaced so the calls can be read back. everything else goes to a recording
//2d context.
const renderMarble = vi.hoisted(() => vi.fn())
vi.mock("@/render/marble-renderer", () => ({ renderMarble }))

type Call = { name: string; args: unknown[] }

/** A canvas context that remembers every method called and property set. */
function recordingContext() {
  const calls: Call[] = []
  const alphas: number[] = []
  const target: Record<string, unknown> = {}
  const ctx = new Proxy(target, {
    get(_, name: string) {
      if (name === "calls") return calls
      return (...args: unknown[]) => {
        calls.push({ name, args })
      }
    },
    set(_, name: string, value: unknown) {
      if (name === "globalAlpha") alphas.push(value as number)
      return true
    },
  })
  const count = (name: string) =>
    calls.filter((call) => call.name === name).length
  return {
    ctx: ctx as unknown as CanvasRenderingContext2D,
    count,
    alphas,
  }
}

const ROW = ["0,-1", "0,0", "0,1"]

describe("diagramAspect", () => {
  //one tile is a pointy hex of grid size 1: root three wide and two tall
  it("is root three over two for a single tile", () => {
    expect(diagramAspect({ cells: ["0,0"] })).toBeCloseTo(Math.sqrt(3) / 2)
  })

  it("grows as the diagram gets wider than it is tall", () => {
    expect(diagramAspect({ cells: ROW })).toBeGreaterThan(
      diagramAspect({ cells: ["0,0"] }),
    )
  })

  it("makes room for a marble off the board, which has no tile", () => {
    const withCapture = diagramAspect({
      cells: ROW,
      marbles: { "0,2": "white" },
    })

    expect(withCapture).toBeGreaterThan(diagramAspect({ cells: ROW }))
  })

  it("makes room for a mark outside the tiles", () => {
    const marked = diagramAspect({
      cells: ROW,
      marks: [{ pos: "0,2", kind: "target" }],
    })

    expect(marked).toBeGreaterThan(diagramAspect({ cells: ROW }))
  })

  it("is the same for any order of the same cells", () => {
    expect(diagramAspect({ cells: [...ROW].reverse() })).toBeCloseTo(
      diagramAspect({ cells: ROW }),
    )
  })
})

describe("drawDiagram", () => {
  beforeEach(() => {
    renderMarble.mockClear()
  })

  it("clears the canvas and stops for a diagram with no cells", () => {
    const { ctx, count } = recordingContext()

    drawDiagram(ctx, { width: 200, height: 100, cells: [] })

    expect(count("clearRect")).toBe(1)
    expect(count("fill")).toBe(0)
    expect(renderMarble).not.toHaveBeenCalled()
  })

  it("paints a tile and an empty square for every cell", () => {
    const { ctx, count } = recordingContext()

    drawDiagram(ctx, { width: 300, height: 100, cells: ROW })

    //three tile fills and three square fills
    expect(count("fill")).toBe(6)
    expect(count("arc")).toBe(3)
  })

  it("paints each marble in its side's colour with the chosen design", () => {
    const { ctx } = recordingContext()

    drawDiagram(ctx, {
      width: 300,
      height: 100,
      cells: ROW,
      marbles: { "0,-1": "white", "0,0": "black" },
      marbleDesign: "3d",
    })

    expect(renderMarble).toHaveBeenCalledTimes(2)
    expect(
      renderMarble.mock.calls.map((call) => [call[0], call[5]]),
    ).toEqual([
      ["3d", "#fff"],
      ["3d", "#333"],
    ])
  })

  it("fades a marble that is off the board, and only that one", () => {
    const { ctx, alphas, count } = recordingContext()

    drawDiagram(ctx, {
      width: 300,
      height: 100,
      cells: ROW,
      marbles: { "0,1": "white", "0,2": "black" },
    })

    expect(alphas).toEqual([0.45])
    //every save is matched, so the fade cannot leak into what comes next
    expect(count("save")).toBe(count("restore"))
  })

  it("draws the arrows and the blocked marks it is given", () => {
    const plain = recordingContext()
    drawDiagram(plain.ctx, { width: 300, height: 100, cells: ROW })

    const decorated = recordingContext()
    drawDiagram(decorated.ctx, {
      width: 300,
      height: 100,
      cells: ROW,
      marbles: { "0,-1": "white" },
      arrows: [{ pos: "0,-1", dir: [0, 1] }],
      marks: [
        { pos: "0,1", kind: "target" },
        { pos: "0,0", kind: "blocked" },
      ],
    })

    expect(decorated.count("stroke")).toBeGreaterThan(
      plain.count("stroke"),
    )
    //the target is a filled dot of its own
    expect(decorated.count("arc")).toBeGreaterThan(plain.count("arc"))
  })

  it("scales the marbles with the canvas", () => {
    const small = recordingContext()
    drawDiagram(small.ctx, {
      width: 150,
      height: 50,
      cells: ROW,
      marbles: { "0,0": "white" },
    })
    const smallRadius = renderMarble.mock.calls[0][4] as number

    renderMarble.mockClear()
    const large = recordingContext()
    drawDiagram(large.ctx, {
      width: 300,
      height: 100,
      cells: ROW,
      marbles: { "0,0": "white" },
    })

    expect(renderMarble.mock.calls[0][4]).toBeCloseTo(smallRadius * 2)
  })
})
