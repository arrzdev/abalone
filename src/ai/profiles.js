/**
 * The eight bots.
 *
 * A profile is how far the bot looks ahead, how much it cares about each thing
 * it can see, and how often it simply does something else. Every trait is a
 * multiplier on a term the evaluator normalises to roughly 0..1, so the numbers
 * are directly comparable to one another.
 *
 * Difficulty is not modelled as "a good player, handicapped". A weak bot wants
 * the wrong things — it chases marbles it cannot catch, drives forward with no
 * plan and parks on the rim — which is what makes it beatable in ways a person
 * can actually find. The last four are the same player thinking further ahead.
 */

/** Traits every profile has, so a missing one is a typo rather than a zero. */
const TRAITS = [
  'depth',
  'capture', // marbles taken, the only thing that actually wins
  'centre', // holding the middle
  'cohesion', // marbles standing close together
  'edgePressure', // crowding opponents who are already near the rim
  'shovePotential', // lining up behind opponents to push them off
  'chase', // closing on the opponent for its own sake
  'charge', // driving forward regardless of what is behind
  'recklessness', // sitting near the rim without noticing
  'loner', // leaving marbles with no support
  'caprice', // chance of ignoring the search and playing at random
];

/**
 * `edgePressure` and `shovePotential` only come into play once the bot is
 * actually winning the centre — see `attackAppetite` in the evaluator. The
 * others apply flat.
 */
const PROFILES = {
  // Beginner: has instincts, acts on all of them at once.
  1: { depth: 1, capture: 1, centre: 0.5, cohesion: 0.1, edgePressure: 0, shovePotential: 0, chase: 0.4, charge: 0.5, recklessness: 0.1, loner: 0.2, caprice: 0.15 },
  // Novice: the same shape, less of every bad habit.
  2: { depth: 1, capture: 1, centre: 0.6, cohesion: 0.15, edgePressure: 0, shovePotential: 0, chase: 0.25, charge: 0.3, recklessness: 0.05, loner: 0.1, caprice: 0.1 },
  // Learner: halfway to playing positionally.
  3: { depth: 1, capture: 1, centre: 0.65, cohesion: 0.18, edgePressure: 0, shovePotential: 0, chase: 0.15, charge: 0.1, recklessness: 0, loner: 0.05, caprice: 0.08 },
  // Casual: wants the right things, just not very hard, and never plans a push.
  4: { depth: 1, capture: 1, centre: 0.7, cohesion: 0.2, edgePressure: 0, shovePotential: 0, chase: 0.1, charge: 0, recklessness: 0, loner: 0, caprice: 0.05 },
  // Intermediate: the bad habits are gone and the attacking instincts arrive.
  5: { depth: 1, capture: 1, centre: 0.5, cohesion: 0.1, edgePressure: 0.5, shovePotential: 0.5, chase: 0, charge: 0, recklessness: 0, loner: 0, caprice: 0 },
  // Advanced: the same player, far more insistent about the centre.
  6: { depth: 1, capture: 1, centre: 2, cohesion: 0.3, edgePressure: 0.5, shovePotential: 0.5, chase: 0, charge: 0, recklessness: 0, loner: 0, caprice: 0 },
  // Expert: Advanced, plus a reply.
  7: { depth: 2, capture: 1, centre: 2, cohesion: 0.3, edgePressure: 0.5, shovePotential: 0.5, chase: 0, charge: 0, recklessness: 0, loner: 0, caprice: 0 },
  // Master: Expert, plus the answer to the reply.
  8: { depth: 3, capture: 1, centre: 2, cohesion: 0.3, edgePressure: 0.5, shovePotential: 0.5, chase: 0, charge: 0, recklessness: 0, loner: 0, caprice: 0 },
};

for (const [level, profile] of Object.entries(PROFILES)) {
  for (const trait of TRAITS) {
    if (typeof profile[trait] !== 'number') {
      throw new Error(`bot ${level} is missing the '${trait}' trait`);
    }
  }
  Object.freeze(profile);
}

export const LEVELS = Object.keys(PROFILES).map(Number);
export const WEAKEST = Math.min(...LEVELS);
export const STRONGEST = Math.max(...LEVELS);

/** The profile for a level, clamped so a bad level never crashes a game. */
export function profileFor(level) {
  return PROFILES[level] ?? PROFILES[WEAKEST];
}
