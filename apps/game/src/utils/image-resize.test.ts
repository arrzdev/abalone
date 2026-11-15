import { afterEach, describe, expect, it, vi } from "vitest"
import { AVATAR_SIZE, resizeToAvatar } from "@/utils/image-resize"

//the browser's image decoding and canvas are stood in: what is under test is
//the crop (centred cover) and the two ways the resize can fail

type Draw = [bitmap: unknown, x: number, y: number, w: number, h: number]

let draws: Draw[]
let canvas: { width: number; height: number }
let bitmap: {
  width: number
  height: number
  close: ReturnType<typeof vi.fn>
}

function arrange(options: {
  size: { width: number; height: number }
  context?: boolean
  encoded?: Blob | null
}) {
  draws = []
  bitmap = { ...options.size, close: vi.fn() }
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(async () => bitmap),
  )

  const context = {
    drawImage: (...args: Draw) => {
      draws.push(args)
    },
  }
  canvas = { width: 0, height: 0 }
  const element = Object.assign(canvas, {
    getContext: () => (options.context === false ? null : context),
    toBlob: vi.fn((done: (blob: Blob | null) => void) => {
      done(
        options.encoded === undefined
          ? new Blob(["webp"])
          : options.encoded,
      )
    }),
  })
  vi.spyOn(document, "createElement").mockReturnValue(
    element as unknown as HTMLCanvasElement,
  )
}

describe("resizeToAvatar", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("draws a square of the avatar size and hands back the encoded blob", async () => {
    const encoded = new Blob(["webp"], { type: "image/webp" })
    arrange({ size: { width: 256, height: 256 }, encoded })

    const result = await resizeToAvatar(new Blob(["x"]))

    expect(result).toBe(encoded)
    expect(canvas).toMatchObject({
      width: AVATAR_SIZE,
      height: AVATAR_SIZE,
    })
    expect(draws).toEqual([[bitmap, 0, 0, 256, 256]])
  })

  it("crops a landscape picture to its centre, sides off", async () => {
    arrange({ size: { width: 512, height: 256 } })

    await resizeToAvatar(new Blob(["x"]))

    //scaled until the shorter side (height) fills the square; the width
    //overflows by half a square either way
    expect(draws).toEqual([[bitmap, -128, 0, 512, 256]])
  })

  it("crops a portrait picture to its centre, top and bottom off", async () => {
    arrange({ size: { width: 128, height: 512 } })

    await resizeToAvatar(new Blob(["x"]))

    //scale 2: 256 wide, 1024 tall, centred
    expect(draws).toEqual([[bitmap, 0, -384, 256, 1024]])
  })

  it("scales a small picture up, never leaving a gap", async () => {
    arrange({ size: { width: 64, height: 64 } })

    await resizeToAvatar(new Blob(["x"]))

    expect(draws).toEqual([[bitmap, 0, 0, 256, 256]])
  })

  it("asks for WebP and lets go of the decoded bitmap", async () => {
    arrange({ size: { width: 256, height: 256 } })

    await resizeToAvatar(new Blob(["x"]))

    const [, type, quality] = (
      canvas as unknown as { toBlob: { mock: { calls: unknown[][] } } }
    ).toBlob.mock.calls[0]
    expect(type).toBe("image/webp")
    expect(quality).toBe(0.85)
    expect(bitmap.close).toHaveBeenCalledTimes(1)
  })

  it("fails, releasing the bitmap, when there is no 2d context", async () => {
    arrange({ size: { width: 256, height: 256 }, context: false })

    await expect(resizeToAvatar(new Blob(["x"]))).rejects.toThrow(
      "avatar_resize_failed",
    )
    expect(bitmap.close).toHaveBeenCalledTimes(1)
  })

  it("fails when the browser encodes nothing", async () => {
    arrange({ size: { width: 256, height: 256 }, encoded: null })

    await expect(resizeToAvatar(new Blob(["x"]))).rejects.toThrow(
      "avatar_resize_failed",
    )
  })

  it("passes on a decode failure for the caller to report", async () => {
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => {
        throw new Error("not an image")
      }),
    )

    await expect(resizeToAvatar(new Blob(["x"]))).rejects.toThrow(
      "not an image",
    )
  })
})
