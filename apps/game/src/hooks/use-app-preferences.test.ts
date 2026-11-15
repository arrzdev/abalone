import { act } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  useAnimationsEnabled,
  useAutoRotateBoard,
  useShowBoardLabels,
  useShowEvalBar,
  useSoundPreferences,
} from "@/hooks/use-app-preferences"
import { stubMemoryStorage } from "@/test-support/memory-storage"
import { renderHook } from "@/test-support/render-hook"
import {
  playMoveSound,
  setSoundMuted,
  setSoundVolume,
} from "@/utils/sound"

vi.mock("@/utils/sound", () => ({
  DEFAULT_VOLUME: 0.7,
  playMoveSound: vi.fn(),
  setSoundMuted: vi.fn(),
  setSoundVolume: vi.fn(),
}))

function stubReducedMotion(reduced: boolean) {
  vi.stubGlobal("matchMedia", () => ({ matches: reduced }))
}

describe("preference hooks", () => {
  beforeEach(() => {
    stubMemoryStorage()
    stubReducedMotion(false)
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe("useAnimationsEnabled", () => {
    it("is on by default", () => {
      const hook = renderHook(useAnimationsEnabled)
      expect(hook.current[0]).toBe(true)
      hook.unmount()
    })

    it("is off by default for someone who asked for less motion", () => {
      stubReducedMotion(true)
      const hook = renderHook(useAnimationsEnabled)
      expect(hook.current[0]).toBe(false)
      hook.unmount()
    })

    //a stated preference beats an inferred one
    it("lets a saved choice beat the system setting", () => {
      stubReducedMotion(true)
      localStorage.setItem("abalone-animations-enabled", "true")
      const hook = renderHook(useAnimationsEnabled)
      expect(hook.current[0]).toBe(true)
      hook.unmount()
    })

    //this one key is a bare "true"/"false", not the JSON the others use
    it("saves the bare string the game always wrote", () => {
      const hook = renderHook(useAnimationsEnabled)
      act(() => hook.current[1](false))
      expect(localStorage.getItem("abalone-animations-enabled")).toBe(
        "false",
      )
      hook.unmount()
    })

    it("ignores a stored value that is not a boolean", () => {
      localStorage.setItem("abalone-animations-enabled", "maybe")
      const hook = renderHook(useAnimationsEnabled)
      expect(hook.current[0]).toBe(true)
      hook.unmount()
    })
  })

  describe("boolean preferences", () => {
    it.each([
      ["showBoardLabels", useShowBoardLabels, true],
      ["showEvalBar", useShowEvalBar, true],
      ["autoRotateBoard", useAutoRotateBoard, false],
    ] as const)("%s starts on its default", (_key, useIt, fallback) => {
      const hook = renderHook(useIt)
      expect(hook.current[0]).toBe(fallback)
      hook.unmount()
    })

    it.each([
      ["showBoardLabels", useShowBoardLabels],
      ["showEvalBar", useShowEvalBar],
      ["autoRotateBoard", useAutoRotateBoard],
    ] as const)(
      "%s round-trips through the prefixed JSON key",
      (key, useIt) => {
        const first = renderHook(useIt)
        act(() => first.current[1](!first.current[0]))
        const saved = first.current[0]
        expect(localStorage.getItem(`abalone_${key}`)).toBe(
          JSON.stringify(saved),
        )
        first.unmount()

        const second = renderHook(useIt)
        expect(second.current[0]).toBe(saved)
        second.unmount()
      },
    )

    it("falls back when the stored value is not a boolean", () => {
      localStorage.setItem("abalone_showEvalBar", JSON.stringify("yes"))
      const hook = renderHook(useShowEvalBar)
      expect(hook.current[0]).toBe(true)
      hook.unmount()
    })
  })

  describe("useSoundPreferences", () => {
    it("starts at the default volume, unmuted, and tells the sound module", () => {
      const hook = renderHook(useSoundPreferences)
      expect(hook.current.volume).toBe(0.7)
      expect(hook.current.muted).toBe(false)
      expect(setSoundVolume).toHaveBeenCalledWith(0.7)
      expect(setSoundMuted).toHaveBeenCalledWith(false)
      hook.unmount()
    })

    it("clamps a saved volume into 0..1", () => {
      localStorage.setItem("abalone_soundVolume", "3")
      const loud = renderHook(useSoundPreferences)
      expect(loud.current.volume).toBe(1)
      loud.unmount()

      localStorage.setItem("abalone_soundVolume", "-2")
      const quiet = renderHook(useSoundPreferences)
      expect(quiet.current.volume).toBe(0)
      quiet.unmount()
    })

    it("falls back on a volume that is not a finite number", () => {
      localStorage.setItem("abalone_soundVolume", JSON.stringify("loud"))
      const hook = renderHook(useSoundPreferences)
      expect(hook.current.volume).toBe(0.7)
      hook.unmount()
    })

    it("restores a saved mute and passes it on", () => {
      localStorage.setItem("abalone_soundMuted", "true")
      const hook = renderHook(useSoundPreferences)
      expect(hook.current.muted).toBe(true)
      expect(setSoundMuted).toHaveBeenLastCalledWith(true)
      hook.unmount()
    })

    //reaching for the slider is already "I want to hear this"
    it("takes the sound off mute when the volume is touched", () => {
      localStorage.setItem("abalone_soundMuted", "true")
      const hook = renderHook(useSoundPreferences)

      act(() => hook.current.setVolume(0.3))

      expect(hook.current.volume).toBe(0.3)
      expect(hook.current.muted).toBe(false)
      expect(setSoundVolume).toHaveBeenLastCalledWith(0.3)
      hook.unmount()
    })

    it("previews a move sound when coming off mute", () => {
      localStorage.setItem("abalone_soundMuted", "true")
      const hook = renderHook(useSoundPreferences)

      act(() => hook.current.setMuted(false))

      expect(setSoundMuted).toHaveBeenCalledWith(false)
      expect(playMoveSound).toHaveBeenCalledWith(1)
      hook.unmount()
    })

    it("is silent about it when muting", () => {
      const hook = renderHook(useSoundPreferences)

      act(() => hook.current.setMuted(true))

      expect(hook.current.muted).toBe(true)
      expect(playMoveSound).not.toHaveBeenCalled()
      hook.unmount()
    })
  })
})
