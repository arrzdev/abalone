import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

//the module keeps its audio context, volume and mute switch in module scope,
//so every test loads a fresh copy against a fake Web Audio that records what
//was built and started

type FakeGain = {
  gain: { value: number }
  connect: ReturnType<typeof vi.fn>
}

type FakeAudio = {
  state: "suspended" | "running"
  resume: ReturnType<typeof vi.fn>
  gains: FakeGain[]
  started: Array<{ gain: number }>
  decodeAudioData: ReturnType<typeof vi.fn>
}

let audio: FakeAudio
let fetchUrls: string[]

function installWebAudio(state: FakeAudio["state"] = "running") {
  audio = {
    state,
    resume: vi.fn(() => Promise.resolve()),
    gains: [],
    started: [],
    decodeAudioData: vi.fn(async () => ({ decoded: true })),
  }
  class FakeContext {
    destination = {}
    get state() {
      return audio.state
    }
    resume = audio.resume
    decodeAudioData = audio.decodeAudioData
    createGain(): FakeGain {
      const gain = { gain: { value: 1 }, connect: vi.fn() }
      audio.gains.push(gain)
      return gain
    }
    createBufferSource() {
      //the clip's own gain is the last one built by the time it starts
      return {
        buffer: null,
        connect: vi.fn(),
        start: () =>
          audio.started.push({
            gain: audio.gains.at(-1)?.gain.value ?? NaN,
          }),
      }
    }
  }
  vi.stubGlobal("AudioContext", FakeContext)
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      fetchUrls.push(url)
      return { arrayBuffer: async () => new ArrayBuffer(8) }
    }),
  )
}

async function load() {
  vi.resetModules()
  return import("@/utils/sound")
}

/** Lets the fetch, decode and play promises run to the end. */
async function settle() {
  for (let turn = 0; turn < 10; turn++) await Promise.resolve()
}

/** The master gain: the first one built, before any clip's own shaper. */
function master(): FakeGain {
  return audio.gains[0]
}

describe("sound", () => {
  beforeEach(() => {
    fetchUrls = []
    installWebAudio()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  describe("volume and mute", () => {
    it("builds the audio device on the first play, not at import", async () => {
      const sound = await load()
      sound.setSoundVolume(0.5)
      expect(audio.gains).toHaveLength(0)

      sound.playSound("move")
      expect(audio.gains.length).toBeGreaterThan(0)
    })

    it("opens at the default volume", async () => {
      const sound = await load()
      sound.primeSounds()

      expect(master().gain.value).toBe(sound.DEFAULT_VOLUME)
    })

    it("clamps the volume between silence and full", async () => {
      const sound = await load()
      sound.primeSounds()

      sound.setSoundVolume(3)
      expect(master().gain.value).toBe(1)
      sound.setSoundVolume(-1)
      expect(master().gain.value).toBe(0)
      sound.setSoundVolume(0.25)
      expect(master().gain.value).toBe(0.25)
    })

    //NaN reaching a GainNode throws, inside a react effect
    it("takes a volume that is not a number as the default", async () => {
      const sound = await load()
      sound.primeSounds()

      sound.setSoundVolume(Number.NaN)
      expect(master().gain.value).toBe(sound.DEFAULT_VOLUME)
      sound.setSoundVolume(Number.POSITIVE_INFINITY)
      expect(master().gain.value).toBe(sound.DEFAULT_VOLUME)
    })

    it("mutes to silence and comes back to the volume it had", async () => {
      const sound = await load()
      sound.primeSounds()
      sound.setSoundVolume(0.4)

      sound.setSoundMuted(true)
      expect(master().gain.value).toBe(0)
      sound.setSoundMuted(false)
      expect(master().gain.value).toBe(0.4)
    })

    it("opens muted when it was muted before the device existed", async () => {
      const sound = await load()
      sound.setSoundMuted(true)
      sound.primeSounds()

      expect(master().gain.value).toBe(0)
    })
  })

  describe("primeSounds", () => {
    it("wakes a suspended device and loads both clips", async () => {
      installWebAudio("suspended")
      const sound = await load()

      sound.primeSounds()
      await settle()

      expect(audio.resume).toHaveBeenCalled()
      expect(fetchUrls.map((url) => url.split("/").pop()).sort()).toEqual([
        "marble-fall.m4a",
        "marble-move.m4a",
      ])
    })

    it("does nothing where there is no Web Audio", async () => {
      vi.stubGlobal("AudioContext", undefined)
      vi.stubGlobal("webkitAudioContext", undefined)
      const sound = await load()

      expect(() => sound.primeSounds()).not.toThrow()
      expect(fetchUrls).toEqual([])
    })
  })

  describe("playSound", () => {
    it("plays the clip through its own gain", async () => {
      const sound = await load()

      sound.playSound("move", 1.3)
      await settle()

      expect(audio.started).toEqual([{ gain: 1.3 }])
    })

    it("fetches a clip once, however often it plays", async () => {
      const sound = await load()

      sound.playSound("move")
      sound.playSound("move")
      await settle()
      sound.playSound("move")
      await settle()

      expect(fetchUrls).toHaveLength(1)
      expect(audio.started).toHaveLength(3)
    })

    it("plays nothing while muted", async () => {
      const sound = await load()
      sound.setSoundMuted(true)

      sound.playSound("move")
      await settle()

      expect(audio.started).toEqual([])
      expect(fetchUrls).toEqual([])
    })

    it("plays nothing at volume zero", async () => {
      const sound = await load()
      sound.setSoundVolume(0)

      sound.playSound("fall")
      await settle()

      expect(audio.started).toEqual([])
    })

    it("lets a mute between the request and the decode win", async () => {
      const sound = await load()

      sound.playSound("move")
      sound.setSoundMuted(true)
      await settle()

      expect(audio.started).toEqual([])
    })

    it("resumes a suspended device inside the gesture", async () => {
      installWebAudio("suspended")
      const sound = await load()

      sound.playSound("move")

      expect(audio.resume).toHaveBeenCalledTimes(1)
    })

    it("warns once and stays quiet when a clip cannot be decoded", async () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
      const sound = await load()
      audio.decodeAudioData.mockRejectedValue(new Error("bad audio"))

      sound.playSound("move")
      await settle()
      sound.playSound("move")
      await settle()

      expect(audio.started).toEqual([])
      expect(warn).toHaveBeenCalledTimes(1)
    })
  })

  describe("playMoveSound", () => {
    async function gainFor(marbles: number): Promise<number> {
      const sound = await load()
      sound.playMoveSound(marbles)
      await settle()
      return audio.started.at(-1)?.gain ?? Number.NaN
    }

    it("is louder for more marbles in motion, flattening at the top", async () => {
      expect(await gainFor(1)).toBe(1)
      expect(await gainFor(2)).toBe(1.1)
      expect(await gainFor(3)).toBe(1.3)
      expect(await gainFor(5)).toBe(1.5)
    })

    it("stays on the ladder for counts outside it", async () => {
      expect(await gainFor(0)).toBe(1)
      expect(await gainFor(Number.NaN)).toBe(1)
      expect(await gainFor(40)).toBe(1.5)
    })
  })

  describe("playFallSound", () => {
    it("plays the fall clip at its recorded level", async () => {
      const sound = await load()

      sound.playFallSound()
      await settle()

      expect(fetchUrls[0]).toMatch(/marble-fall\.m4a$/)
      expect(audio.started).toEqual([{ gain: 1 }])
    })
  })
})
