import { linesFor, commitMove, destinationsFor, resolveMove } from '../engine/moves.js';
import { NOWHERE, nameOf } from '../engine/topology.js';
import { positionFromNames, rival, sideFromName } from '../engine/position.js';

/**
 * Which of a side's marbles the other side could knock off the board right now.
 *
 * This is the only thing the bots' voices need to know about the position, and
 * it is asked of the engine rather than answered beside it: the same move
 * generator the game and the search use, run over the side that would be doing
 * the pushing, noting every marble that one of its moves would send over the
 * rim. Nothing here decides anything — no move is chosen, no score is kept, and
 * the position handed in is never touched.
 *
 * Marbles rather than a yes-or-no, because what the bots react to is a marble
 * *arriving* in danger. Danger tends to sit on the board for several moves, so
 * a flag would say "still true" long after the move that caused it, and a bot
 * working from that would either repeat itself or stay quiet about the next
 * marble to walk into trouble. A set can be compared with the one before it.
 *
 * Cost is one full move generation, which is the same work the board already
 * does every time a marble is picked up. It runs once per move played.
 *
 * @param {{black: Set<string>, white: Set<string>}} board
 * @param {'black'|'white'} victim  the side whose marbles might be lost
 * @returns {Set<string>} the squares those marbles stand on
 */
export function marblesAtRisk(board, victim) {
  const attacker = rival(sideFromName(victim));
  const position = positionFromNames(board.black, board.white);
  const doomed = new Set();

  for (const line of linesFor(position, attacker)) {
    for (const target of destinationsFor(position, line, attacker)) {
      const plan = resolveMove(position, line, target, attacker);
      // Only a shove can send anything over the rim, so everything else is
      // settled without building a position for it.
      if (!plan?.shoved.length) continue;
      const outcome = commitMove(position, line, plan.heading, plan.shoved, attacker);
      if (!outcome?.captured) continue;
      plan.shoved.forEach((cell, i) => {
        if (outcome.shovedTo[i] === NOWHERE) doomed.add(nameOf(cell));
      });
    }
  }

  return doomed;
}
