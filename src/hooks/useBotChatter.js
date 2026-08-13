import { useCallback, useEffect, useRef, useState } from 'react';
import { EVENT_RANK, SAY, pickLine } from '../i18n/bots.js';
import { marblesAtRisk } from '../lib/threats.js';

/**
 * What the bot is currently saying.
 *
 * It watches every move played — by either side, because half of what it has to
 * say is about what was just done to it — and says at most one thing about it.
 * A bot that fires three messages for a single push reads as broken rather than
 * talkative, so everything the move offers is collected and `EVENT_RANK` picks
 * the one that wins: a marble actually leaving the board outranks one that
 * merely might, and either outranks small talk.
 *
 * Two things keep it from becoming noise. Danger is remarked on when a marble
 * *walks into* it and not for as long as it lasts: a marble left on the rim
 * because the other player lined up and then thought better of pushing is not
 * news a second time, and every line the bot has is a reaction to the move that
 * has just been played. And a line that has only just gone up is left alone
 * unless what wants to replace it outranks it, so the bubble is never a flicker
 * between two half-read remarks.
 *
 * Small talk is what is left when nothing has happened. It waits for the board
 * to have been quiet for a few moves, so the bot is never mute for long without
 * ever being chatty.
 *
 * The two ends of a game are handled apart from all of that: nothing else can
 * be happening at the moment of an opener or a result, so neither is ranked and
 * neither is ever held back.
 *
 * There is no bot in hot-seat play, so `enabled` switches the whole thing off
 * rather than the caller having to guard every use.
 */

/** Moves of quiet before the bot will fill it with small talk. */
const AMBIENT_GAP = 3;

/** How long a line has the bubble to itself before anything lesser may take it. */
const LINE_HOLD = 2600;

/** Where an event comes in the pecking order; -1 is an opener or a result. */
const rankOf = (event) => EVENT_RANK.indexOf(event);

export function useBotChatter({ level, enabled, phase, winner, botColor, state }) {
  // The key of the line, not the line — it is resolved where it is shown, so the
  // bot keeps saying the same thing through a language change.
  const [line, setLine] = useState(null);
  // What it said last, so a pool of eight doesn't hand back the same line twice
  // running. A ref because choosing a line must not depend on a render.
  const lastLine = useRef(null);
  const lastEvent = useRef(null);
  const spokeAt = useRef(0);

  const say = useCallback(
    (event) => {
      const next = pickLine(level, event, lastLine.current);
      if (!next) return;
      lastLine.current = next;
      lastEvent.current = event;
      spokeAt.current = performance.now();
      setLine(next);
    },
    [level],
  );

  // Everything below is about the game in front of it, and none of it survives
  // into the next one.
  const spokeFor = useRef(-1);
  const quietSince = useRef(0);
  const wasAtRisk = useRef({ black: new Set(), white: new Set() });

  // A game beginning: entering play from either the setup panel or a rematch.
  // Tracked as a transition rather than as "phase is ingame", so the opener
  // fires once per game instead of on every re-render that keeps it there.
  const wasPlaying = useRef(false);
  useEffect(() => {
    if (!enabled) {
      wasPlaying.current = false;
      setLine(null);
      return;
    }
    const playing = phase === 'ingame';
    if (playing && !wasPlaying.current) {
      lastLine.current = null;
      spokeFor.current = -1;
      quietSince.current = 0;
      wasAtRisk.current = { black: new Set(), white: new Set() };
      setLine(null);
      say(SAY.OPENING);
    }
    wasPlaying.current = playing;
  }, [enabled, phase, say]);

  // Everything the bot says during play. Keyed on the move index rather than on
  // the state, which also changes under a hover: a line is a reaction to a move,
  // and there is exactly one of those per index.
  const moveIndex = state?.currentMoveIndex ?? -1;
  const atLatest = moveIndex === (state?.moveHistory?.length ?? 0) - 1;
  useEffect(() => {
    if (!enabled || phase !== 'ingame' || state?.gameOver) return;
    // Stepping back through the game is not the game being played, and a bot
    // that re-reacted to moves you were only re-reading would be talking about
    // a position neither of you is in.
    if (moveIndex <= spokeFor.current || !atLatest) return;

    const details = state.moveHistory[moveIndex]?.moveDetails;
    if (!details) return;
    spokeFor.current = moveIndex;

    const playerColor = botColor === 'black' ? 'white' : 'black';
    const atRisk = { [botColor]: marblesAtRisk(state, botColor), [playerColor]: marblesAtRisk(state, playerColor) };
    // A marble that was already in danger before this move is not news; one that
    // has just been put there — by being moved into it, or by the square beside
    // it changing hands — is.
    const arose = (color) => [...atRisk[color]].some((marble) => !wasAtRisk.current[color].has(marble));

    const offered = new Set();
    if (details.isCapture) {
      offered.add(details.color === botColor ? SAY.BOT_PUSHES_OPPONENT_OFF : SAY.BOT_MARBLE_PUSHED_OFF);
    }
    if (arose(playerColor)) offered.add(SAY.OPPONENT_BALL_AT_RISK);
    if (arose(botColor)) offered.add(SAY.BOT_BALL_AT_RISK);
    wasAtRisk.current = atRisk;

    const event = EVENT_RANK.find((ranked) => offered.has(ranked));
    // Whatever the move had to offer, it was not a quiet one — so the silence
    // small talk fills starts again here even if the line itself was held back.
    if (event) quietSince.current = moveIndex;

    const chosen = event ?? (moveIndex - quietSince.current >= AMBIENT_GAP ? SAY.AMBIENT : null);
    if (!chosen) return;
    if (chosen === SAY.AMBIENT) quietSince.current = moveIndex;

    const fresh = performance.now() - spokeAt.current < LINE_HOLD;
    if (fresh && rankOf(chosen) >= rankOf(lastEvent.current)) return;
    say(chosen);
  }, [atLatest, botColor, enabled, moveIndex, phase, say, state]);

  // The result. A draw is left alone: the roster has a line for winning and a
  // line for losing, and neither of them is true of a draw.
  const spokeResult = useRef(false);
  useEffect(() => {
    if (!enabled || phase !== 'postgame') {
      spokeResult.current = false;
      return;
    }
    if (spokeResult.current || winner == null) return;
    spokeResult.current = true;
    say(winner === botColor ? SAY.GAME_END_WIN : SAY.GAME_END_LOSS);
  }, [botColor, enabled, phase, say, winner]);

  return { line: enabled ? line : null, say };
}
