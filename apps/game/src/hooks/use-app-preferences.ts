import { useCallback, useEffect } from "react"
import { usePersistentState } from "@/hooks/use-persistent-state"
import { ANIMATE_BY_DEFAULT, prefersReducedMotion } from "@/render/motion"
import { PREF_PREFIX, parseStored, serialize } from "@/utils/preferences"
import {
  DEFAULT_VOLUME,
  playMoveSound,
  setSoundMuted,
  setSoundVolume,
} from "@/utils/sound"

/**
 * The preferences the app holds, all of them.
 *
 * There used to be two settings screens, one in the shell and one on the board,
 * and the split was the argument that coordinates and the evaluation bar belong
 * to the game in front of you. They don't: they are how you like a board drawn,
 * the same way the marbles are, and there is one place to say so now. The two
 * that were plain component state are saved here like the rest, so a board comes
 * back the way it was left.
 *
 * `usePersistentState` broadcasts a write to every hook holding the same key, so
 * the sheet and the board it is drawn over never disagree.
 */

/** Whether marbles slide to their square or simply appear on it. */
export function useAnimationsEnabled() {
  return usePersistentState<boolean>(
    //the one key with neither the app's prefix nor its JSON encoding: it is what
    //the game already wrote, and renaming it would reset everyone's choice
    "abalone-animations-enabled",
    prefersReducedMotion() ? false : ANIMATE_BY_DEFAULT,
    (raw) => {
      if (raw === "true") return true
      if (raw === "false") return false
      return null
    },
    String,
  )
}

/** A saved on/off preference, which is all but one of these. */
function useBooleanPreference(key: string, fallback: boolean) {
  return usePersistentState<boolean>(
    `${PREF_PREFIX}${key}`,
    fallback,
    (raw) => {
      const saved = parseStored(raw)
      return typeof saved === "boolean" ? saved : null
    },
    serialize,
  )
}

/** Row letters and column numbers around the board. */
export function useShowCoordinates() {
  return useBooleanPreference("showCoordinates", false)
}

/** The bar down the side of the board, reading out who is ahead. */
export function useShowEvalBar() {
  return useBooleanPreference("showEvalBar", true)
}

/**
 * Whether a hot-seat board turns to face whoever is to move.
 *
 * The key is the one the game wrote when this lived in its own settings, so
 * nobody's choice is reset by the move up here.
 */
export function useAutoRotateBoard() {
  return useBooleanPreference("autoRotateBoard", false)
}

export type SoundPreferences = {
  volume: number
  muted: boolean
  setVolume: (next: number) => void
  setMuted: (next: boolean) => void
}

/**
 * How loud the game is, and the module that plays it kept in step.
 *
 * The sound module holds its own copy of both so a move can be played from
 * anywhere without threading them through; this is what puts the saved values
 * there on load and keeps them there after.
 */
export function useSoundPreferences(): SoundPreferences {
  const [volume, setVolumeState] = usePersistentState<number>(
    `${PREF_PREFIX}soundVolume`,
    DEFAULT_VOLUME,
    (raw) => {
      const saved = parseStored(raw)
      if (typeof saved !== "number" || !Number.isFinite(saved)) return null
      return Math.min(Math.max(saved, 0), 1)
    },
    serialize,
  )
  const [muted, setMutedState] = usePersistentState<boolean>(
    `${PREF_PREFIX}soundMuted`,
    false,
    (raw) => parseStored(raw) === true,
    serialize,
  )

  useEffect(() => setSoundVolume(volume), [volume])
  useEffect(() => setSoundMuted(muted), [muted])

  /**
   * Touching the slider takes the sound off mute. Reaching for the volume is
   * already the whole of "I want to hear this" — making someone say it twice,
   * once on the slider and once on the button, is the kind of thing that gets
   * called a bug.
   */
  const setVolume = useCallback(
    (next: number) => {
      setVolumeState(next)
      setMutedState(false)
    },
    [setMutedState, setVolumeState],
  )

  const setMuted = useCallback(
    (next: boolean) => {
      setMutedState(next)
      // Coming off mute is worth hearing. The module is told before the preview
      // rather than waiting on the effect above, which would arrive one render
      // too late and swallow the very sound it is announcing.
      if (!next) {
        setSoundMuted(false)
        playMoveSound(1)
      }
    },
    [setMutedState],
  )

  return { volume, muted, setVolume, setMuted }
}
