import { getBot } from './bots.js';

/**
 * Game-state copy: the strings that are chosen rather than looked up.
 *
 * Who the bots are lives in `bots.js`, next to what they say — a name and a
 * voice belong to the same character, and keeping them apart is how a roster
 * ends up half-renamed. This only reaches through for the name.
 */

export { BOT_LEVELS } from './bots.js';

export function getBotName(level) {
  return getBot(level).name;
}

export function getDifficultyName(level) {
  return getBotName(level);
}

export function getOpponentName(level) {
  return getDifficultyName(level);
}

/**
 * @param {'player'|'ai'|null} winner  null means a draw
 */
export function getGameOverMessage(t, winner, difficulty) {
  if (winner === null) {
    return { title: t('game:modal.draw'), message: t('game:modal.draw_message') };
  }
  const difficultyName = getDifficultyName(difficulty);
  if (winner === 'player') {
    return {
      title: t('game:modal.you_win'),
      message: t('game:modal.victory_message', { difficulty: difficultyName }),
    };
  }
  return {
    title: t('game:modal.opponent_won', { opponent: getOpponentName(difficulty) }),
    message: t('game:modal.defeat_message', { difficulty: difficultyName }),
  };
}

export const SETUP_NAMES = {
  standard: 'Standard',
  belgianDaisy: 'Belgian Daisy',
  germanDaisy: 'German Daisy',
  dutchDaisy: 'Dutch Daisy',
  swissDaisy: 'Swiss Daisy',
  alien: 'Alien',
  domination: 'Domination',
  infiltration: 'Infiltration',
  theWall: 'The Wall',
};

export function getSetupName(setupKey) {
  return SETUP_NAMES[setupKey] || SETUP_NAMES.standard;
}
