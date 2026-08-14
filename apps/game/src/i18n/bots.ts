/**
 * Who the eight bots are, and where to find what they say.
 *
 * Character content only — nothing here reaches the engine. A bot's level is its
 * strength and its personality both, but only because the same number keys two
 * unrelated tables; changing a line cannot change how one plays.
 *
 * The lines themselves live in the `bots` namespace with the rest of the
 * interface text, keyed by id — `bots:gus.opening.3` — so a translator sees one
 * file per language and every language has the same shape. What is here is only
 * the structure: which levels exist, what each is called, and which pools they
 * draw from. Names are the exception that stays in code: they are proper nouns,
 * identical in all thirteen languages, and thirteen copies of "Gus" is thirteen
 * chances for one of them to drift.
 *
 * One pool is not a transcription of the brief it came from. `BOT_BALL_AT_RISK`
 * arrived written in the attacking voice — "I think I found an opening" — which
 * is the other event, and left the bot with nothing to say about its own marble
 * being the one in trouble. These are written to the definition instead: the bot
 * has spotted the danger, and the danger is its own.
 */

// The English pools are the source of truth for how many lines each bot has, so
// the count is read off them rather than written down twice. Vite hands back the
// same module the locale glob already loaded, so this costs the bundle nothing.
import enBots from "@/i18n/locales/en/bots.json"

/**
 * The moments a bot has something to say, and the key segment each one uses.
 *
 * `AMBIENT` is the fallback and by far the largest pool — it is the only one
 * that may be used at any point in a game, so nothing in it can assume a board
 * state, a turn, or who is ahead.
 */
export const SAY = {
  OPENING: "opening",
  AMBIENT: "ambient",
  BOT_PUSHES_OPPONENT_OFF: "push_off",
  BOT_MARBLE_PUSHED_OFF: "pushed_off",
  OPPONENT_BALL_AT_RISK: "opponent_at_risk",
  BOT_BALL_AT_RISK: "self_at_risk",
  GAME_END_WIN: "win",
  GAME_END_LOSS: "loss",
} as const

/** One of the moments above — the key segment, not the line. */
export type SayEvent = (typeof SAY)[keyof typeof SAY]

/**
 * Which line wins when one move sets off more than one event.
 *
 * A marble actually leaving the board outranks a marble that merely might, and
 * either outranks small talk. One move, one line — a bot that fires three
 * messages for a single push reads as broken rather than talkative.
 *
 * The openers and the two game-end lines are not in this list: they are not
 * competing with anything, because nothing else can happen at the same moment.
 */
export const EVENT_RANK: SayEvent[] = [
  SAY.BOT_PUSHES_OPPONENT_OFF,
  SAY.BOT_MARBLE_PUSHED_OFF,
  SAY.OPPONENT_BALL_AT_RISK,
  SAY.BOT_BALL_AT_RISK,
  SAY.AMBIENT,
]

export type Bot = { id: string; name: string }

/** Level → character. `id` is the key segment; `name` is the same everywhere. */
export const BOTS: Record<number, Bot> = {
  1: { id: "gus", name: "Gus" },
  2: { id: "milo", name: "Milo" },
  3: { id: "nora", name: "Nora" },
  4: { id: "theo", name: "Theo" },
  5: { id: "iris", name: "Iris" },
  6: { id: "victor", name: "Victor" },
  7: { id: "clara", name: "Clara" },
  8: { id: "magnus", name: "Magnus" },
}

export const BOT_LEVELS: number[] = Object.keys(BOTS).map(Number)

const FALLBACK = BOTS[1]

/** The character at a level, falling back to the first rather than to nothing. */
export function getBot(level: number): Bot {
  return BOTS[level] || FALLBACK
}

/** The key for a bot's one-line description, and for its title. */
export const blurbKey = (level: number) => `bots:${getBot(level).id}.blurb`
export const titleKey = (level: number) => `bots:${getBot(level).id}.title`

/**
 * Where a bot's portrait is.
 *
 * Named after the character rather than the level, because that is what the
 * picture is of: reordering the ladder should move a face up it, not repaint
 * someone else's. Every portrait is a square 256px crop framed on the face —
 * one file for all three places a bot is shown, since the largest of them is
 * 48px and a retina screen wants twice that.
 *
 * The vector originals are kept in `assets/avatars/` at the root of this app,
 * outside `public/`, so the full-size art is not shipped to draw a thumbnail.
 */
export const avatarSrc = (level: number) =>
  `${import.meta.env.BASE_URL}images/avatars/${getBot(level).id}.webp`

//the locale json is a fixed shape to a translator and a bag of pools to this
//file, which reads it with an id and an event it only knows at runtime. the
//`title` and `blurb` beside the pools are strings rather than lists, so the
//lookup goes through `unknown` and the pool is checked at the point of use
const POOLS = enBots as unknown as Record<
  string,
  Record<string, string[] | undefined>
>

/**
 * The key of a line for the moment, or null when the bot has nothing to say.
 *
 * What comes back is an id, not a sentence — the line is only resolved where it
 * is shown, so a language change mid-game re-speaks what the bot is saying now
 * rather than stranding it in the language it was picked in.
 *
 * `avoid` is the key it said last. Pools run from eight to fifteen entries and a
 * bot is asked for one often, so the same line coming round twice in a row is
 * common enough to notice and cheap enough to rule out — drop it from the draw
 * rather than re-rolling, which can land on it again.
 */
export function pickLine(
  level: number,
  event: SayEvent,
  avoid: string | null = null,
): string | null {
  const { id } = getBot(level)
  const pool = POOLS[id]?.[event]
  if (!pool?.length) return null

  const keys = pool.map((_, i) => `bots:${id}.${event}.${i}`)
  const choices =
    keys.length > 1 ? keys.filter((key) => key !== avoid) : keys
  return choices[Math.floor(Math.random() * choices.length)]
}
