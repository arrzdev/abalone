/**
 * The board's two sounds, both recorded off a physical Abalone set.
 *
 * Every marble in a move lands at the same instant — a three-marble shove is
 * not three clacks in a row, it is one clack with more weight behind it. So the
 * move sound is a single clip whose gain rises with how many marbles were in
 * motion, and nothing here ever overlaps a sound with itself.
 *
 * That ladder tops out above 1, which is why this goes through the Web Audio
 * API rather than an `<audio>` element: `HTMLMediaElement.volume` is clamped to
 * 1, a `GainNode` is not. The recordings peak at −10.8 dBFS (move) and −4.3
 * dBFS (fall), so even the loudest rung has headroom to spare.
 */

export type SoundName = "move" | "fall"

const CLIPS: Record<SoundName, string> = {
  move: `${import.meta.env.BASE_URL}audio/marble-move.m4a`,
  fall: `${import.meta.env.BASE_URL}audio/marble-fall.m4a`,
}

/**
 * Gain by number of marbles in motion, the mover's and the pushed alike: one
 * marble is the recording as it was made, and five — a three-marble line shoving
 * two — is half again as loud. It flattens towards the top on purpose, because
 * loudness does: the step from one marble to two is the audible one.
 */
const WEIGHT = [1, 1, 1.1, 1.3, 1.4, 1.5]

const DEFAULT_VOLUME = 0.7

let context: AudioContext | null = null
let master: GainNode | null = null
/** url -> AudioBuffer, or a Promise while it loads */
const buffers = new Map<
  string,
  AudioBuffer | Promise<AudioBuffer | null>
>()

let volume = DEFAULT_VOLUME
let muted = false

/** Undecodable audio should cost one warning, not one per move. */
let warned = false

function levelNow() {
  return muted ? 0 : volume
}

/**
 * Created on the first play, not at import: a page that is never played on
 * should not hold an audio device open, and Safari counts a context built
 * outside a gesture against you.
 */
function audio(): AudioContext | null {
  if (context) return context
  //why: safari still ships the prefixed constructor, which no dom lib declares
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext
  if (!Ctor) return null

  context = new Ctor()
  master = context.createGain()
  master.gain.value = levelNow()
  master.connect(context.destination)
  return context
}

function bufferFor(
  url: string,
): AudioBuffer | Promise<AudioBuffer | null> | null {
  const held = buffers.get(url)
  if (held) return held

  const ctx = audio()
  if (!ctx) return null

  const loading = fetch(url)
    .then((response) => response.arrayBuffer())
    .then((bytes) => ctx.decodeAudioData(bytes))
    .then((decoded) => {
      buffers.set(url, decoded)
      return decoded
    })
    .catch((error) => {
      buffers.delete(url)
      if (!warned) {
        warned = true
        console.warn("Sound unavailable:", error)
      }
      return null
    })

  buffers.set(url, loading)
  return loading
}

/**
 * Wakes the audio device and pulls both clips into memory. Call it from a real
 * user gesture — a browser will not start a context outside one, and a move
 * that had to fetch and decode before it could be heard would arrive after the
 * marbles had already landed.
 */
export function primeSounds(): void {
  const ctx = audio()
  if (!ctx) return
  if (ctx.state === "suspended") ctx.resume().catch(() => {})
  for (const url of Object.values(CLIPS)) bufferFor(url)
}

/**
 * Plays one clip.
 *
 * @param gain multiplier on top of the user's volume; the marble ladder lives
 *        above unity, so this is not clamped to 1.
 */
export function playSound(name: SoundName, gain = 1): void {
  const url = CLIPS[name]
  if (!url || muted || volume <= 0) return

  const ctx = audio()
  if (!ctx) return
  // The gesture that triggered this is the one chance to resume, so take it
  // before anything is awaited.
  if (ctx.state === "suspended") ctx.resume().catch(() => {})

  Promise.resolve(bufferFor(url)).then((buffer) => {
    // Muting between the request and the decode has to win.
    if (!buffer || !master || muted || volume <= 0) return

    const source = ctx.createBufferSource()
    source.buffer = buffer

    const shaper = ctx.createGain()
    shaper.gain.value = gain

    source.connect(shaper)
    shaper.connect(master)
    source.start()
  })
}

/** The move sound, weighted by how many marbles the move set in motion. */
export function playMoveSound(marbleCount: number): void {
  const step = Math.min(
    Math.max(Math.round(marbleCount) || 1, 1),
    WEIGHT.length - 1,
  )
  playSound("move", WEIGHT[step])
}

/**
 * A marble going over the rim. It plays on top of the move that pushed it, not
 * after: the shove and the fall are one motion, and the marble is over the edge
 * by the time the line it was in has finished sliding.
 */
export function playFallSound(): void {
  playSound("fall")
}

export function setSoundVolume(next: number): void {
  // A stored preference is whatever was in localStorage, which is not
  // necessarily a number. NaN reaching a GainNode throws, and a throw in here
  // happens inside a React effect — so it is caught at the door.
  volume = Number.isFinite(next)
    ? Math.min(Math.max(next, 0), 1)
    : DEFAULT_VOLUME
  if (master) master.gain.value = levelNow()
}

export function setSoundMuted(next: boolean): void {
  muted = Boolean(next)
  if (master) master.gain.value = levelNow()
}

export { DEFAULT_VOLUME }
