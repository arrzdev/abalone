import { createBot } from './search.js';
import { WEAKEST } from './profiles.js';

/**
 * The bot's thread.
 *
 * One bot is kept alive for the whole game rather than made per move, because
 * it remembers the positions the game has already stood in — take that away and
 * it will happily shuffle a pair of marbles back and forth forever.
 */
let bot = null;

self.onmessage = ({ data: { kind, ticket, payload } }) => {
  try {
    switch (kind) {
      case 'open':
        bot = createBot(payload.level);
        self.postMessage({ kind: 'opened', ticket });
        break;

      case 'think':
        bot ??= createBot(payload.level ?? WEAKEST);
        self.postMessage({ kind: 'move', ticket, move: bot.chooseMove(payload.board) });
        break;

      case 'close':
        bot = null;
        self.postMessage({ kind: 'closed', ticket });
        break;

      default:
        throw new Error(`unknown request '${kind}'`);
    }
  } catch (error) {
    self.postMessage({ kind: 'failed', ticket, reason: error?.message || String(error) });
  }
};
