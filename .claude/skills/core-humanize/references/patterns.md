# Pattern catalog

Every tell worth knowing, grouped by the layer it lives in. Merged from `harshaneel/humanize`, `conorbronsdon/avoid-ai-writing` and `blader/humanizer`, deduplicated, with the carve-outs that stop each rule from eating good writing.

Quoted "before" text deliberately contains the patterns. Do not flag the examples.

- [Layer 0: mechanical](#layer-0-mechanical)
- [Layer 1: structure and rhythm](#layer-1-structure-and-rhythm)
- [Layer 2: assistant register](#layer-2-assistant-register)
- [Layer 3: rhetorical scaffolding](#layer-3-rhetorical-scaffolding)
- [Layer 4: content patterns](#layer-4-content-patterns)
- [Vocabulary tiers](#vocabulary-tiers)
- [Filler substitutions](#filler-substitutions)

---

## Layer 0: mechanical

Counted by `scripts/aitells.py`. No judgment required, so there is no excuse for leaving one in.

**Any dash used as punctuation. Zero, everywhere, no exceptions.** The em dash is the most reliable single punctuation tell; models use them at three to five times the human rate. The rule covers all four forms, since they do the same job: em dash, en dash, double hyphen, and the spaced hyphen. No list-item carve-out, no register relaxation, and a writing sample does not license them back in. Replace in this order: period, comma, colon, parentheses, restructure.
> The new policy — announced without warning — affects thousands of workers. The build is green - finally.

> The new policy, announced without warning, affects thousands of workers. The build is finally green.

The wrapping form (`X — like this — Y`) is almost exclusively machine output. Three or more in a paragraph means the paragraph has structural problems, not punctuation problems.

Hyphenated compounds are untouched: `sign-in`, `two-factor`, `high-quality`, `end-to-end`. The test is whether you could swap the mark for "to", "and", or a pause. If you could, it is a clause break, so restructure. Numeric ranges (`10 - 20 seconds`) and list bullets are not dashes in this sense, and the scanner already skips them.

**Semicolons.** Outside academic and legal registers, prose almost never uses them. Replace with a period, or with "and" / "but" / "so" when the relationship matters. Exception: list items containing commas ("San Francisco, CA; Austin, TX").

**Mid-sentence colons.** Fine after a complete clause to introduce something. Mid-thought it is an AI shape: "The problem: nobody tests this" becomes "Nobody tests this." One colon per paragraph in non-list prose.

**Curly quotes and apostrophes.** Register-scoped, per the resolution table in SKILL.md. Replace with straight quotes in plaintext, commits and code comments; leave them in published prose and in locale-correct punctuation.

**Emoji in headings and bullets.** Cut. Social posts may carry one or two at end of line.

**Bold overuse.** One bolded phrase per section at most. If it matters enough to bold, restructure the sentence so it leads.

**Title Case headings.** Sentence case for subheads. Title case at most for the piece title.

**Inline-header bullets.** `- **Performance:** Performance has been enhanced through optimized algorithms.` The header restates itself. Write the point, or make it a paragraph.

**List-label periods.** `- **Intros.** Years of conferences.` A person writes `**Intros:** years of conferences`. The period reads as a sentence that the next clause then contradicts by continuing.

**Hashtag stuffing.** Six or more on a short post. Human posts that exceed five are usually launch posts; LLM social output defaults to ten to fifteen. Two or three specific tags, or none.

**Fingerprints, not styles.** `citeturn0search0`, `contentReference[oaicite:0]`, `[Your Name]`, `2025-XX-XX`, `utm_source=chatgpt.com`, zero-width characters. Nobody types these. Their presence is close to proof of paste-without-cleanup, whatever the surrounding prose reads like. Delete; do not rewrite.

---

## Layer 1: structure and rhythm

The highest-weighted signal in trained classifiers, and the one a vocabulary pass leaves untouched.

**Sentence-length uniformity.** Uncorrected model rhythm clusters at 10 to 20 words with about six words of deviation. Targets, verified from the scanner's printed length list rather than by reading aloud:

1. longest minus shortest at least 20 words (needs a fragment of 5 or fewer AND a 25-plus sentence that earns it)
2. fewer than half the sentences in the 10-to-20 band
3. no three consecutive mid-length sentences within 5 words of each other
4. at least one sentence of 6 words or fewer per 150 words

Burstiness fails in both directions. A run of shorts with no long counterweight reads choppy, not punchy. The classic trap is a varied opener and closer wrapped around three middle sentences that all sit at 14 words.

**Paragraph uniformity.** Every paragraph three to five sentences of similar size is a shape, not a choice. Some paragraphs should be one sentence.

**Wall-of-text replies.** In conversational registers (issue comments, chat, DMs), humans break at thought boundaries. A reply-length text with four or more sentences and no line break anywhere is the tell. Does not apply to long-form prose, where a dense paragraph is correct.

**Excessive structure.** More than three headings under 300 words. Eight or more bullets under 200 words. Boilerplate section names (Overview, Key Points, Summary, Conclusion, Challenges and Future Prospects). Numbered-list inflation ("Five things to know") where the content does not have five discrete parallel items.

**Bullet lists of bare noun phrases.** Five or more consecutive items of the shape `adjective + noun`, no verbs, all the same length: "Stable mining efficiency / Reliable pool connectivity / Optimized RandomX performance". The tell is the symmetry, and that none of the items assert anything checkable. Rewrite as claims ("Failed shares stayed under 1% across a 12-hour run") or as prose. Genuine list content (changelogs, parameter docs, ingredients) is exempt.

**Low vocabulary diversity.** In pieces over 200 words, a type-token ratio under 0.40 suggests the model locked onto a small vocabulary loop. Human general prose runs about 0.50 to 0.65. Narrow technical topics and second-language writing legitimately compress. The fix is not a thesaurus: name specific things, and replace a re-used abstract noun with the concrete instance behind it.

**Fragmented headers.** A heading followed by a one-line warm-up restating it, before the real content starts. Cut the warm-up.

---

## Layer 2: assistant register

What modern detectors actually fire on. Base-model output reads as human; the RLHF layer is the tell.

| Tell | Fix |
|---|---|
| "Here's how I'd think about it", "Let me walk you through" | Cut the frame. Say the thing. |
| Balanced tradeoff offering: "on one hand X, on the other Y, it depends" | Pick a side. The reader is allowed to disagree. |
| Enumerated options nobody asked for | Answer. Mention the constraint after, if it matters. |
| Defining terms the audience knows, recapping shared context | Cut. Trust the reader. |
| "Important caveats" bolted onto every claim | Make the claim. Caveat only plausible edge cases. |
| "That's a great question, and…" | Cut entirely. |
| Closing summary of what you just said | Cut. |
| "I hope this helps", "Let me know if you'd like me to elaborate" | End on the last substantive sentence. |
| "While I understand the appeal of X, I would suggest…" | "X doesn't work, because Y." |
| Knowledge-cutoff disclaimers | Say what you know, or say you don't know it. |
| "Here is an overview of…", "Of course!", "Certainly!" | Strip on sight. Published prose never carries them. |
| Reasoning-chain leakage: "Let me think step by step", "Breaking this down", "First, let's consider" | The reader does not need the scaffolding. State the conclusion, then the evidence. |
| Acknowledgment loops: "You're asking about…", "To answer your question" | Just answer. |
| Recap-flattery: opening a reply by summarizing the other person's own work back at them with praise | Substance first. One plain clause of thanks, then the point. |

**Register collapse in Slack and async updates.** The most-missed case. AI writes Slack as a polished status report with informal markers sprinkled on top. Real async writing has fragments, self-corrections ("oh also", "wait, actually"), thoughts that loop back, numerals with approximation (`~3-4 days`, `<10min`, `fwiw`, `lmk`), lowercase except proper nouns, and a single-word line as an ending. Crucially the **structure has to break**: accomplishment then caveat then next steps is still the three-act arc even with `fwiw` sprinkled in. Add a fourth element that does not fit, or end on an unset-up question.

**Templated professional closers.** "Happy to jump on a call", "Feel free to reach out", "Let me know if you have any questions". Real emails end after the last substantive point, or with a specific ask.

---

## Layer 3: rhetorical scaffolding

The checklist lives in SKILL.md because it runs every time. Extra detail on the ones people misjudge:

**Negative parallelism, all four forms.** The joined form ("It's not just about the beat, it's part of the aggression"). The **split** form, where the negation and the correction are separate sentences ("The headline isn't the speed. The real story is trust."), which slips past checks tuned to the joined phrasing. The **countdown** ("It's not the price. It's not the features. It's the trust."). The **tailing negation**, a bare fragment stapled to a sentence ("The options come from the selected item, no guessing."). Say what the thing is. Carve-out: spec constraints in a list ("no dependencies, no telemetry") are list content.

**Poetic forms count.** "It isn't proof you failed, it's proof you showed up" is the same banned pivot in nicer clothes. Creative and lyrical registers are where the "this one is doing literary work" rationalization is strongest, and detectors do not grade on artistic merit.

**"More X than Y" comparative framing.** Describing something by framing it against an opposite. Humans describe directly.

**"Turns out" pivots** and **participial reframes** ("Laid out that way, the same facts read like a strategy"). Both manufacture a discovery narrative. State the observation.

**Setup sentences.** "What I didn't expect was X", "What surprised me was Y". The colon is not the tell; the announcement is. Lead with X.

**Infomercial hooks.** "The catch?", "The kicker?", "Plot twist:", "The result?". Delete the hook, state the thing.

**Fake-candid openers.** "Honestly?", "Look,", "Real talk:", "Here's the thing." as standalone hooks staging a pause before an ordinary point. Mid-sentence "honestly" in casual prose is ordinary English and stays.

**Manufactured punchlines and staccato drama.** Three or more same-shape fragments in a row, each posing as a reveal: "It had no preference for symmetry. No aesthetic prior. No nostalgia for human taste." One fragment that earns emphasis is rhythm. A drumroll of them is engineering. This composes with the burstiness rule: variation is the human signal, uniform manufactured drama is not.

**Composed self-aware parenthetical.** "(which I choose to read as progress)". Real reflection names the behavior and stops.

**Within-sentence anaphoric list.** "what existed before, what problem it solved, why it mattered, what changed after". Vary the noun forms.

**Aphorism formulas.** "X is the language of Y", "X is the currency of Z", "the architecture of trust", "X becomes a trap". The shape does the persuading instead of the evidence. Replace with the concrete claim it gestures at. Carve-out: real idioms and quotations ("time is money") stay.

**Invented labels.** Coining a pseudo-analytical compound mid-sentence and never defining it ("the supervision paradox", "a coordination tax"). Naming a concept is not explaining it.

**Novelty inflation.** "He introduced a term I hadn't heard", "the failure mode nobody's naming", "what nobody tells you about". Most ideas are applications of existing ones. Describe what the person did with the concept.

---

## Layer 4: content patterns

Largely from Wikipedia's "Signs of AI writing", which was built from thousands of observed cases.

**Significance inflation.** "stands as a testament to", "marks a pivotal moment in", "evolving landscape", "setting the stage for", "reflects a broader shift".
> The Statistical Institute of Catalonia was officially established in 1989, marking a pivotal moment in the evolution of regional statistics in Spain.

> The Statistical Institute of Catalonia was established in 1989, part of a wider decentralization of administrative functions in Spain.

If the sentence still works after deleting the inflation clause, delete it.

**Promotional register.** "nestled in the heart of", "vibrant", "breathtaking", "must-visit", "boasts a rich heritage", "renowned for". Models lose neutral tone hardest on cultural and place topics.
> Nestled within the breathtaking region of Gonder, Alamata Raya Kobo stands as a vibrant town with a rich cultural heritage.

> Alamata Raya Kobo is a town in the Gonder region of Ethiopia.

**Superficial -ing analyses.** Present participles bolted on to fake depth: "symbolizing Texas bluebonnets, reflecting the community's deep connection to the land". Also the declarative form: "this represents a broader shift", "the decision symbolizes a commitment to excellence". Show the consequence or cut.

**Vague attribution.** "Experts believe", "Studies show", "Industry observers have noted". Name the source or drop the claim. Never invent one to make a sentence sound sourced.

**Vague third-party validation.** The inverse move: an unnamed authority plus a superlative ("independent testing confirms we lead"). Name the benchmark, the date, the result, or cut it.

**Notability name-dropping.** "cited in The New York Times, BBC, Financial Times, and The Hindu." One reference with context beats four name-drops. Related: historical-analogy stacking ("like the printing press, the telegraph, and the internet before it"). Name the one parallel that does analytical work.

**Copula avoidance.** "serves as", "stands as", "represents", "features", "boasts", "offers" where "is" or "has" is the word.
> Gallery 825 serves as LAAA's exhibition space and boasts over 3,000 square feet.

> Gallery 825 is LAAA's exhibition space. It has 3,000 square feet across four rooms.

**Rule of three.** "keynote sessions, panel discussions, and networking opportunities. Innovation, inspiration, and industry insights." Use two items, or four, or a sentence. One "adjective, adjective, and adjective" per piece, maximum.

**False ranges.** "from the Big Bang to the enigmatic dance of dark matter", "from ancient civilizations to modern startups". The endpoints are not on a shared scale. List the real topics.

**Synonym cycling.** "The protagonist faces challenges. The main character must adapt. The central figure triumphs." One person, three labels. Pick the canonical noun; vary with a pronoun. Repeating the right word three times is human.

**Subjectless fragments and agentless passives.** "No configuration file needed." "The results are preserved automatically." Name the actor when it clarifies. Carve-out: README feature lists, changelogs, parameter docs and commit subjects, where the fragment is the correct form.

**Speculative gap-filling.** When a model lacks a fact it writes hedged filler that looks like background: "maintains a low profile", "likely grew up in", "appears to have studied". Worse than a cutoff disclaimer, because the reader cannot tell what is known from what is invented. Say what is not documented, or cut the sentence.

**Formulaic challenges.** "Despite these challenges, the organization continues to thrive." A non-statement. Name the challenge and the response, or cut.

**Generic conclusions.** "The future looks bright", "Only time will tell", "As we move forward". End on the last concrete fact.

**Future-narrative closers.** modal + "become" + "one of the most [adjective]" + narrative/trend/chapter. Grammatically a prediction, containing nothing testable. Write the falsifiable version or drop it.

**Hedge-stacked predictions.** "could potentially create", "may eventually unlock", "might ultimately transform". Either word alone is fine; the stack asserts nothing while sounding careful.

**Real/actual inflation.** "real utility", "genuine product-market fit", "actual reward sustainability". Implies the rest of the field is fake without saying what makes this one real. Carve-out: when the contrast is named ("actual revenue from paying customers, not grants"), it is honest writing.

**Moral adjectives on non-agents.** "an honest shape", "a faithful number", "flagged honestly". Shapes are not moral agents. State the concrete property: "a more realistic curve".

**Invented contrast-pair mirroring.** One half is a real term of art, the other is fabricated to balance the sentence: "false precision rather than genuine accuracy". "False precision" is real; "genuine accuracy" is a phantom. Reach for an actual opposite or drop the contrast.

**Confidence calibration phrases.** "It's worth noting", "Interestingly", "Notably", "Importantly", "Undoubtedly". Telling the reader how to feel about a fact instead of letting it land. One in 2,000 words is fine; three in 500 is emphasis stacking.

**Persuasive authority tropes.** "the real question is", "at its core", "fundamentally", "make no mistake", "the truth is". They announce depth; the sentence after usually restates an ordinary point with ceremony.

**Emotional flatline.** "What surprised me most", "I was fascinated to discover", "Interesting part of the project:". Claiming an emotion the writing did not earn. Also lazy human writing; flag either way.

**Lingering-attention claims.** "the line I keep coming back to", "I can't stop thinking about this". Unfalsifiable, self-flattering, and it arrives before the reader has a reason to care. Carve-out: leave it when the sentence says why the thing recurred.

**Social endorsement closers.** "This one is worth your time:", "Do yourself a favor and read this." Performs a recommendation without giving a reason. Say what the thing is and who it is for.

**Speculative scenario openers.** "Imagine a world where every deploy is instant." The scenario does the persuading and no evidence is offered. Carve-out: fiction, a thought experiment with a stated payoff, and teaching devices ("imagine you have a sorted array").

**Rhetorical question openers.** "But what does this mean for developers?" Stalling before the point. Earned by strong setup, not dropped in as a section transition.

**Parenthetical hedging.** "(and, increasingly, Z)", "(or, more precisely, Y)". If the aside matters, give it a sentence.

**False concession.** "While X is impressive, Y remains a challenge." Balanced without weighing anything, and both halves vague.

**Hyphenated-pair overuse.** Two problems. Density ("a high-quality, well-architected, future-proof solution"), and the attributive/predicate error: "a high-quality report" keeps the hyphen, "the report is high quality" does not. Models hyphenate both.

**Diff-anchored writing.** Documentation narrating a change instead of describing the thing: "This function was added to replace the previous approach." A reader without the commit history gets archaeology. Carve-out: changelogs, release notes, migration guides and decision records narrate change correctly.

**Template phrases.** Anything with a slot that could take a different noun and read the same: "a [adjective] step towards [adjective] AI infrastructure", "Whether you're a startup founder or an enterprise architect" (false breadth: it means "everyone"), "I recently had the pleasure of attending".

---

## Vocabulary tiers

Tiering matters: flat word lists produce false positives on words that are fine alone and damning in clusters.

**Tier 1, replace on sight.** delve, leverage (verb), utilize, robust, comprehensive, streamline, pivotal, meticulous, seamless, tapestry, testament to, realm, paradigm, embark, beacon, cutting-edge, underscore, nestled, vibrant, thriving, bustling, showcase, intricate, intricacies, ever-evolving, enduring, daunting, holistic, actionable, impactful, learnings, thought leadership, best practices, at its core, synergy, interplay, in order to, due to the fact that, serves as, boasts, commence, ascertain, endeavor, game-changer, watershed moment, deep dive, dive into, unpack, myriad, plethora, in the realm of, the landscape of, the future looks bright, only time will tell.

**Tier 2, flag when two or more land in one paragraph.** harness, navigate, foster, elevate, unleash, empower, bolster, spearhead, resonate, revolutionize, facilitate, underpin, nuanced, crucial, multifaceted, ecosystem, encompass, catalyze, reimagine, galvanize, augment, cultivate, illuminate, elucidate, juxtapose, transformative, cornerstone, paramount, poised to, burgeoning, nascent, quintessential, overarching, garner, align with, deeply (in significance collocations only).

**Tier 3, flag only at density.** significant, innovative, effective, dynamic, scalable, compelling, unprecedented, exceptional, remarkable, sophisticated, instrumental, world-class, state-of-the-art, best-in-class, valuable, key. Roughly 3% of total words is the threshold.

**Tier 3 phrases, flag at two uses or three distinct phrases.** emerging sector, the integration of, the intersection of, community-driven, long-term sustainability, user engagement, decentralized compute, tokenized incentive structures, designed for long-term X.

Match inflected forms (`leverage` covers `leveraging`, `leveraged`), except where a variant has an honest separate sense. Technical registers keep legitimate technical uses: `robust`, `comprehensive`, `seamless`, `ecosystem`, `leverage` (actual platform leverage), `facilitate`, `underpin`, `streamline`. Still flag `delve`, `tapestry`, `beacon`, `embark`, `testament to`, `game-changer`, `harness` anywhere.

The tables give defaults, not mandates. When a flagged word is the right word here, keep it.

---

## Filler substitutions

The pattern generalizes: any multi-word wrapper around a one-word meaning gets the one word.

| Verbose | Concise |
|---|---|
| Due to the fact that | Because |
| In the event that | If |
| Has the ability to / capacity to | Can |
| Make a decision / an assumption | Decide / Assume |
| For the purpose of | To |
| With regard to / With respect to | About |
| Prior to / Subsequent to | Before / After |
| In light of the fact that / Despite the fact that | Since / Although |
| At this point in time | Now |
| In terms of / The fact that / In the process of | (drop and rephrase) |
| It is important to note that the data shows | The data shows |

Transitions: "Moreover" and "Furthermore" become "and", "also", or nothing. "In addition to the above" becomes "and". "It is clear that" gets deleted. "As previously mentioned" means do not mention it again. "This highlights the importance of" becomes what the importance actually is.
