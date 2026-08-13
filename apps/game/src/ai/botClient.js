import { createBot } from './search.js';
import { WEAKEST } from './profiles.js';

/**
 * A bot, thinking somewhere else.
 *
 * The search is a tight synchronous loop, and at the deeper levels it runs long
 * enough to be felt: on the main thread it would stall React mid-render and the
 * board would freeze with a marble half-way to its square. So it is handed to a
 * worker and awaited, which costs a message round trip and buys a page that
 * keeps painting while the bot thinks.
 *
 * Where Workers are unavailable the same search runs inline. It is slower to
 * live with, never wrong.
 */
export class BotClient {
  #worker = null;
  #inline = null;
  #level = WEAKEST;
  #nextTicket = 1;
  #waiting = new Map();

  /** Starts a fresh bot for a new game. */
  async connect(level) {
    this.#level = level;
    this.#inline = null;

    const sent = this.#send('open', { level });
    if (sent) await sent;
    else this.#inline = createBot(level);
  }

  /**
   * @param {{black: string[], white: string[], turn: string}} board from `toSearchState`
   * @returns {Promise<{type: string, selection: string[]|null, move: string|null, score: number}>}
   */
  async requestMove(board) {
    const sent = this.#send('think', { board, level: this.#level });
    if (sent) {
      try {
        return await sent;
      } catch {
        // The worker died mid-search. Answer inline rather than skip a turn —
        // but note that its memory of the game went with it.
      }
    }
    this.#inline ??= createBot(this.#level);
    return this.#inline.chooseMove(board);
  }

  disconnect() {
    this.#worker?.terminate();
    this.#worker = null;
    for (const { reject } of this.#waiting.values()) reject(new Error('bot disconnected'));
    this.#waiting.clear();
    this.#inline = null;
  }

  /** @returns {Promise|null} null when there is no worker to send to. */
  #send(kind, payload) {
    const worker = this.#connectWorker();
    if (!worker) return null;

    const ticket = this.#nextTicket++;
    return new Promise((resolve, reject) => {
      this.#waiting.set(ticket, { resolve, reject });
      worker.postMessage({ kind, ticket, payload });
    });
  }

  #connectWorker() {
    if (this.#worker || typeof Worker === 'undefined') return this.#worker;

    try {
      this.#worker = new Worker(new URL('./bot.worker.js', import.meta.url), { type: 'module' });
      this.#worker.onmessage = ({ data }) => {
        const pending = this.#waiting.get(data.ticket);
        if (!pending) return;
        this.#waiting.delete(data.ticket);
        if (data.kind === 'failed') pending.reject(new Error(data.reason));
        else pending.resolve(data.move);
      };
      this.#worker.onerror = (event) => {
        // Fail everything in flight; each caller falls back to the inline search.
        for (const { reject } of this.#waiting.values()) {
          reject(new Error(event.message || 'bot worker error'));
        }
        this.#waiting.clear();
        this.#worker = null;
      };
    } catch {
      this.#worker = null;
    }
    return this.#worker;
  }
}
