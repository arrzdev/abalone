# Registers, tolerance and voice

Three separate axes, often confused:

- **Register** is what kind of text this is. It decides which rules relax.
- **Voice** is how the prose should sound. It decides what you write toward.
- **A writing sample** outranks both. If the user gave you their own writing, match it and ignore any rule below that contradicts it. The single exception is the dash rule: zero dashes as punctuation, even when their sample is full of them.

## Picking the register

Ask, or infer from the text, and say which one you picked when it isn't obvious.

| Cue | Register |
|---|---|
| Under 300 words, hashtags or @mentions | social |
| Code blocks, API names, architecture | technical |
| Salutation plus a fundraising or client ask | email |
| Step-by-step instructions, parameter tables, README shape | docs |
| Lowercase, fragments, a thread reply | casual |
| Fiction, lyric, mood piece | creative |
| Neutral third person about a subject, no author presence | encyclopedic |
| No strong signal | blog (the strict default) |

## Tolerance matrix

Rules not listed apply at full strength everywhere. "Skip" means the rule does not apply to this register, not that it is optional. The dash rule is the one row with no relaxation anywhere.

| Rule | social | blog | technical | email | docs | casual |
|---|---|---|---|---|---|---|
| Dashes as punctuation | zero | zero | zero | zero | zero | zero |
| Curly quotes | skip | skip | strict (code, commits) | skip | relaxed | strict (plaintext) |
| Bold overuse | relaxed (hooks work) | strict | strict | strict | relaxed | skip |
| Emoji | relaxed (1-2, end of line) | strict | strict | strict | skip | skip |
| Excessive bullets | skip | strict | relaxed | strict | skip | skip |
| Hedging | strict | strict | relaxed ("may" is often accurate) | strict | relaxed | skip |
| Tier 1 vocabulary | strict | strict | partial (see below) | strict | relaxed | worst offenders only |
| Promotional register | relaxed (some sell expected) | strict | strict | extra strict | strict | skip |
| Significance inflation | strict | strict | strict | extra strict | relaxed | skip |
| Copula avoidance | skip | strict | relaxed | strict | skip | skip |
| Paragraph uniformity | skip | strict | strict | strict | relaxed | skip |
| Numbered-list inflation | relaxed | strict | relaxed | strict | skip | skip |
| Rhetorical questions | relaxed (1 hook) | strict | strict | strict | strict | skip |
| Transition phrases | skip | strict | strict | strict | relaxed | skip |
| Generic conclusions | skip | strict | strict | extra strict | skip | skip |
| Hashtag stuffing | strict | strict | strict | extra strict | skip | skip |
| Subjectless fragments | relaxed (the register) | strict | relaxed | strict | skip | skip |
| Bare noun-phrase bullets | strict | strict | relaxed | strict | relaxed | skip |
| First-person absence | strict | strict | relaxed | relaxed | skip | skip |

**Technical carve-out.** These have real technical meaning and stay: robust, comprehensive, seamless, ecosystem, leverage (actual platform leverage), facilitate, underpin, streamline. These do not, anywhere: delve, tapestry, beacon, embark, testament to, game-changer, harness.

**Extra strict** means flag borderline instances. In an investor email one "thriving ecosystem" can undermine the whole message.

## Register notes that matter

**Technical.** Domain-native vocabulary ("the hot path", "this falls apart at scale", "the footgun here"). Short sentences for definitive claims. Tradeoffs stated directly, not diplomatically. Real tool names, versions, error strings when you have them. Prefer "X is Y" over inflated substitutes. Jargon is fine; define it on first use.

**Slack and async updates.** Register collapse is the primary tell, and it survives every other fix. Real async writing has: fragments instead of clauses ("hard commits: billing gRPC + pprof thing"), self-corrections ("oh also", "wait, actually"), thoughts that bleed together and loop back rather than one topic per paragraph, numerals with approximation (`~60%`, `<10min`, `~3-4 days`), abbreviations (fwiw, btw, lmk, tmrw), lowercase except proper nouns, single-word lines. Above all the **structure has to break**: accomplishment then caveat then next steps is the three-act arc even when it is sprinkled with `fwiw`. Add a fourth element that does not fit, or end on a question nobody set up.

**Professional and business.** Cut the throat-clearing opener. The ask lands in sentence one or two. Numbers and deadlines ("by Thursday EOD", "the three blockers are"). Two or three sentences per paragraph in email.

**Narrative, blog, essay.** Open on a scene or a specific moment, not a thesis. Let the argument emerge from the evidence. Deliberate fragments for rhythm. One moment of genuine uncertainty or a changed mind per 500 words.

**Creative and lyrical.** The register where every rule gets rationalized away, and detectors do not grade on artistic merit. The traps: the "literary dash" exemption ("a feeling too new to have a name yet"), poetic negation pivots ("it isn't proof you failed, it's proof you showed up"), anaphora sold as lyricism ("Not every door has been tried. Not every version of yourself."), mid-sentence colon reveals, balanced imagery pairs and escalating tricolons. Human lyrical prose is lopsided; machine lyrical prose is symmetric. Texture comes from specificity and asymmetry: a named street, a wrong note, an image that does not resolve.

**Encyclopedic, legal, reference.** Neutral and plain **is** the human voice. Do not add first person, opinions, or personality here. The failure mode in this register is the promotional and significance-inflation family, not flatness.

## Voice profiles

Optional. If the user does not name one, infer it from the input's existing register and do not impose a persona on text that already has one.

**casual.** Contractions throughout; their absence reads stiff. Short sentences, average 14 words or under; fragments fine. At least one first-person or concrete-anecdote touch. Near-zero jargon. Keep warm hedges ("honestly", "I think"), cut corporate ones ("it's worth noting").

**professional.** Active voice. Varied sentence length. One concrete claim per paragraph: a number, a name, a date, never "experts say". Explicit ask. Low tolerance for hedging.

**technical.** Plain copulatives over inflated substitutes. One idea per sentence. Imperative for instructions. Tables and lists only where content is genuinely list-shaped.

**warm.** Address the reader directly and acknowledge them at least once. Cut intensifiers in favor of stronger verbs. No performative empathy ("I completely understand how you feel"). Medium sentences, 15 to 20 words, unhurried.

**blunt.** Lead with the claim. Periods for emphasis, never dashes. No padding to reach a rule of three. Near-zero hedging. Short declaratives with an occasional long sentence for contrast.

**How the axes compose.** Voice sets the target, register sets how hard to enforce it. A voice target still applies where a register would skip the rule: technical voice keeps plain copulatives even in a casual register. Where they conflict, take the stricter of the two: a warm voice in docs still gets no decorative tables. Sensible pairings: casual with casual or social, professional with email, technical with docs or technical.

## Matching a supplied sample

Read the sample before you touch the new text and extract hypotheses, not impressions:

1. Sentence length: range, variance, signature fragments.
2. Vocabulary level: "stuff" and "things", or "elements" and "components".
3. Paragraph openers: straight in, context first, a question, a scene.
4. Punctuation habits: parentheticals, ellipses, fragments, comma density. (Their dashes do not carry over: rewrite those as periods or commas in their voice.)
5. Recurring phrases and verbal tics ("honestly", "basically", "look,").
6. Transition style: explicit connectors, or the next thought with no bridge.

Write five to ten specific hypotheses ("never opens with a thesis", "fragments in conclusions", "sentence range roughly 6 to 28 words"), then apply the skill's rules in service of those hypotheses. Do not upgrade their vocabulary, and do not regularize a deliberate quirk. A rewrite that strips every AI pattern but replaces none of them with the author's own patterns is clean, generic, and not theirs.
